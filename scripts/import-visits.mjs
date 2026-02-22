#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const DEFAULT_COLLECTION = 'visits';
const DEFAULT_PROCEDURE = 'Консультація';
const MAX_BATCH_SIZE = 400;

function printUsage() {
  console.log(
    `\nUsage:\n  node scripts/import-visits.mjs [options]\n\nOptions:\n  --file=<path>                 Path to input file (.csv/.tsv/.json) (required)\n  --uid=<uid>                   Override owner UID for all rows (optional)\n  --format=<auto|csv|json>      Input format (default: auto)\n  --apply                       Apply writes (default: dry-run)\n  --collection=<name>           Firestore collection (default: visits)\n  --project-id=<id>             Firebase project id (optional)\n  --service-account=<path>      Path to service account JSON (optional)\n  --delimiter=<auto|comma|semicolon|tab>  Delimiter for CSV/TSV (default: auto)\n  --default-procedure=<name>    Procedure fallback (default: Консультація)\n  --year=<yyyy>                 Default year for dates without year (default: current year)\n  --help                        Show this message\n\nCSV expected columns (header recommended):\n  Дата, ПІБ, Сума, %\nOptional columns:\n  Послуга, Примітки\n\nJSON expected rows:\n  [{ ownerUid, patientName, procedureName, amount, percent|doctorIncome, visitDate, notes?, createdAt?, updatedAt? }]\n\nNotes:\n  - For CSV, if \"%\" value is > 100, script treats it as doctor income amount and derives percent.\n  - For CSV, empty date cells reuse previous parsed date (spreadsheet-style grouped rows).\n  - For JSON, ownerUid is read per row unless --uid override is provided.\n\nExamples:\n  npm run import:visits -- --file=./data/january.csv --uid=USER_UID\n  npm run import:visits -- --apply --file=./data/january.tsv --uid=USER_UID --delimiter=tab --year=2026\n  npm run import:visits -- --file=./data/january.json\n  npm run import:visits -- --apply --file=./data/january.json --uid=USER_UID\n`
  );
}

function parseArgs(argv) {
  const nowYear = new Date().getFullYear();
  const options = {
    filePath: '',
    uid: '',
    inputFormat: 'auto',
    apply: false,
    collection: DEFAULT_COLLECTION,
    projectId: '',
    serviceAccountPath: '',
    delimiter: 'auto',
    defaultProcedure: DEFAULT_PROCEDURE,
    defaultYear: nowYear,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg.startsWith('--file=')) {
      options.filePath = (arg.split('=')[1] || '').trim();
      continue;
    }

    if (arg.startsWith('--uid=')) {
      options.uid = (arg.split('=')[1] || '').trim();
      continue;
    }

    if (arg.startsWith('--format=')) {
      options.inputFormat = (arg.split('=')[1] || 'auto').trim().toLowerCase();
      continue;
    }

    if (arg.startsWith('--collection=')) {
      options.collection = (arg.split('=')[1] || DEFAULT_COLLECTION).trim() || DEFAULT_COLLECTION;
      continue;
    }

    if (arg.startsWith('--project-id=')) {
      options.projectId = (arg.split('=')[1] || '').trim();
      continue;
    }

    if (arg.startsWith('--service-account=')) {
      options.serviceAccountPath = (arg.split('=')[1] || '').trim();
      continue;
    }

    if (arg.startsWith('--delimiter=')) {
      options.delimiter = (arg.split('=')[1] || 'auto').trim().toLowerCase();
      continue;
    }

    if (arg.startsWith('--default-procedure=')) {
      options.defaultProcedure = (arg.split('=')[1] || DEFAULT_PROCEDURE).trim() || DEFAULT_PROCEDURE;
      continue;
    }

    if (arg.startsWith('--year=')) {
      const parsed = Number(arg.split('=')[1]);
      if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
        throw new Error('Invalid --year value. Expected yyyy in range 2000..2100.');
      }
      options.defaultYear = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['auto', 'comma', 'semicolon', 'tab'].includes(options.delimiter)) {
    throw new Error('Invalid --delimiter. Use auto|comma|semicolon|tab.');
  }

  if (!['auto', 'csv', 'json'].includes(options.inputFormat)) {
    throw new Error('Invalid --format. Use auto|csv|json.');
  }

  return options;
}

function detectInputFormat(filePath, rawText, selectedFormat) {
  if (selectedFormat !== 'auto') {
    return selectedFormat;
  }

  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.json')) {
    return 'json';
  }
  if (lowerPath.endsWith('.csv') || lowerPath.endsWith('.tsv')) {
    return 'csv';
  }

  const trimmed = rawText.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      return 'csv';
    }
  }

  return 'csv';
}

async function loadServiceAccount(pathFromArg) {
  if (pathFromArg) {
    const raw = await readFile(pathFromArg, 'utf8');
    return JSON.parse(raw);
  }

  const rawFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawFromEnv) {
    return JSON.parse(rawFromEnv);
  }

  return null;
}

async function resolveProjectId(projectIdFromArg) {
  const fromArg = String(projectIdFromArg ?? '').trim();
  if (fromArg) {
    return fromArg;
  }

  const fromEnv =
    String(process.env.FIREBASE_PROJECT_ID ?? '').trim() ||
    String(process.env.GOOGLE_CLOUD_PROJECT ?? '').trim() ||
    String(process.env.GCLOUD_PROJECT ?? '').trim();

  if (fromEnv) {
    return fromEnv;
  }

  try {
    const firebasercRaw = await readFile('.firebaserc', 'utf8');
    const firebaserc = JSON.parse(firebasercRaw);
    const fromFirebaserc = String(firebaserc?.projects?.default ?? '').trim();
    if (fromFirebaserc) {
      return fromFirebaserc;
    }
  } catch {
    // ignore: file may not exist or contain invalid json
  }

  return '';
}

async function initFirestore(projectId, serviceAccountPath) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const serviceAccount = await loadServiceAccount(serviceAccountPath);

  if (!getApps().length) {
    if (serviceAccount) {
      const inferredProjectId = resolvedProjectId || serviceAccount.project_id;
      initializeApp({
        credential: cert(serviceAccount),
        ...(inferredProjectId ? { projectId: inferredProjectId } : {})
      });
    } else {
      initializeApp(resolvedProjectId ? { projectId: resolvedProjectId } : undefined);
    }
  }

  return getFirestore();
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function detectDelimiter(lines) {
  const candidates = [
    { name: 'comma', value: ',' },
    { name: 'semicolon', value: ';' },
    { name: 'tab', value: '\t' }
  ];

  let best = candidates[1];
  let bestScore = -1;

  for (const candidate of candidates) {
    const lengths = lines
      .slice(0, 8)
      .map((line) => parseCsvLine(line, candidate.value).length)
      .filter((length) => length > 1);
    if (!lengths.length) {
      continue;
    }

    const score = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function normalizeHeader(value) {
  return value
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHeader(cells) {
  const joined = cells.map((cell) => normalizeHeader(cell)).join('|');
  return joined.includes('дата') && (joined.includes('піб') || joined.includes('пацієн')) && joined.includes('сума');
}

function resolveColumnMap(headerCells) {
  const map = {
    date: -1,
    patientName: -1,
    amount: -1,
    percentOrIncome: -1,
    procedureName: -1,
    notes: -1
  };

  headerCells.forEach((rawCell, index) => {
    const cell = normalizeHeader(rawCell);
    if (!cell) {
      return;
    }

    if (map.date === -1 && (cell.includes('дата') || cell === 'date')) {
      map.date = index;
      return;
    }

    if (map.patientName === -1 && (cell.includes('піб') || cell.includes('пацієнт') || cell.includes('patient'))) {
      map.patientName = index;
      return;
    }

    if (map.amount === -1 && (cell.includes('сума') || cell.includes('amount'))) {
      map.amount = index;
      return;
    }

    if (
      map.percentOrIncome === -1 &&
      (cell === '%' || cell.includes('відсот') || cell.includes('процент') || cell.includes('дохід') || cell.includes('income'))
    ) {
      map.percentOrIncome = index;
      return;
    }

    if (map.procedureName === -1 && (cell.includes('послуга') || cell.includes('процедур') || cell.includes('procedure'))) {
      map.procedureName = index;
      return;
    }

    if (map.notes === -1 && (cell.includes('приміт') || cell.includes('коментар') || cell.includes('note'))) {
      map.notes = index;
    }
  });

  if (map.date === -1) {
    map.date = 0;
  }
  if (map.patientName === -1) {
    map.patientName = 1;
  }
  if (map.amount === -1) {
    map.amount = 2;
  }
  if (map.percentOrIncome === -1) {
    map.percentOrIncome = 3;
  }

  return map;
}

function parseNumber(rawValue) {
  const normalized = String(rawValue ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeMonthToken(value) {
  return value.toLowerCase().replace(/\./g, '').replace(/[^a-zа-яіїєґ]/giu, '');
}

function resolveMonth(monthToken) {
  const normalized = normalizeMonthToken(monthToken);
  const aliases = {
    '1': ['1', '01', 'jan', 'january', 'січ', 'січень'],
    '2': ['2', '02', 'feb', 'february', 'лют', 'лютий'],
    '3': ['3', '03', 'mar', 'march', 'бер', 'берез', 'березень'],
    '4': ['4', '04', 'apr', 'april', 'квіт', 'квітень'],
    '5': ['5', '05', 'may', 'трав', 'травень'],
    '6': ['6', '06', 'jun', 'june', 'черв', 'червень'],
    '7': ['7', '07', 'jul', 'july', 'лип', 'липень'],
    '8': ['8', '08', 'aug', 'august', 'серп', 'серпень'],
    '9': ['9', '09', 'sep', 'sept', 'september', 'вер', 'верес', 'вересень'],
    '10': ['10', 'oct', 'october', 'жовт', 'жовтень'],
    '11': ['11', 'nov', 'november', 'лист', 'листопад'],
    '12': ['12', 'dec', 'december', 'груд', 'грудень']
  };

  for (const [month, values] of Object.entries(aliases)) {
    if (values.includes(normalized)) {
      return Number(month);
    }
  }

  return null;
}

function toIsoDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDate(rawValue, defaultYear) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const numericMatch = value.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    const yearRaw = numericMatch[3];
    const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : defaultYear;
    return toIsoDate(year, month, day);
  }

  const tokenMatch = value.match(/^(\d{1,2})\s*[-\s]\s*([a-zа-яіїєґ.]+)(?:\s*[-\s,]?\s*(\d{4}))?$/iu);
  if (tokenMatch) {
    const day = Number(tokenMatch[1]);
    const month = resolveMonth(tokenMatch[2]);
    const year = tokenMatch[3] ? Number(tokenMatch[3]) : defaultYear;
    if (!month) {
      return null;
    }
    return toIsoDate(year, month, day);
  }

  return null;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function pickProcedure(patientName, rawProcedure, fallbackProcedure) {
  const procedure = String(rawProcedure ?? '').trim();
  if (procedure) {
    return procedure;
  }

  if (/\bоперац/i.test(patientName)) {
    return 'Операція';
  }

  return fallbackProcedure;
}

function cleanPatientName(value) {
  return value.replace(/\s*\(([^)]*операц[^)]*)\)\s*/giu, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUid(value) {
  const uid = String(value ?? '').trim();
  return uid || null;
}

function parseDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMetaRowName(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized === 'піб' ||
    normalized === 'дата' ||
    normalized === 'сума' ||
    normalized.startsWith('зараховано') ||
    normalized.startsWith('всього') ||
    normalized.startsWith('итого') ||
    normalized.startsWith('разом')
  );
}

function parseRows(rawText, options) {
  const normalizedText = rawText.replace(/^\uFEFF/, '');
  const rawLines = normalizedText.split(/\r?\n/).map((line) => line.trimEnd());
  const lines = rawLines.filter((line) => line.trim().length > 0);

  if (!lines.length) {
    throw new Error('Input file is empty.');
  }

  const delimiterInfo =
    options.delimiter === 'auto'
      ? detectDelimiter(lines)
      : {
          name: options.delimiter,
          value: options.delimiter === 'comma' ? ',' : options.delimiter === 'semicolon' ? ';' : '\t'
        };

  const parsedLines = lines.map((line) => parseCsvLine(line, delimiterInfo.value).map((cell) => String(cell ?? '').trim()));

  const firstLineIsHeader = looksLikeHeader(parsedLines[0]);
  const columnMap = resolveColumnMap(firstLineIsHeader ? parsedLines[0] : []);
  const startIndex = firstLineIsHeader ? 1 : 0;

  let currentDate = null;
  const drafts = [];
  const warnings = [];

  for (let i = startIndex; i < parsedLines.length; i += 1) {
    const cells = parsedLines[i];
    const sourceLineNumber = i + 1;

    if (looksLikeHeader(cells)) {
      continue;
    }

    const rawName = String(cells[columnMap.patientName] ?? '').trim();
    if (!rawName) {
      continue;
    }

    if (isMetaRowName(rawName)) {
      continue;
    }

    const rawDate = String(cells[columnMap.date] ?? '').trim();
    if (rawDate) {
      const parsedDate = parseDate(rawDate, options.defaultYear);
      if (!parsedDate) {
        warnings.push(`Line ${sourceLineNumber}: invalid date "${rawDate}" -> skipped.`);
        continue;
      }
      currentDate = parsedDate;
    }

    if (!currentDate) {
      warnings.push(`Line ${sourceLineNumber}: missing date (and no previous date to reuse) -> skipped.`);
      continue;
    }

    const amount = parseNumber(cells[columnMap.amount]);
    if (amount === null || amount <= 0) {
      warnings.push(`Line ${sourceLineNumber}: invalid amount "${cells[columnMap.amount] ?? ''}" -> skipped.`);
      continue;
    }

    const percentOrIncome = parseNumber(cells[columnMap.percentOrIncome]);
    if (percentOrIncome === null || percentOrIncome < 0) {
      warnings.push(`Line ${sourceLineNumber}: invalid %/income "${cells[columnMap.percentOrIncome] ?? ''}" -> skipped.`);
      continue;
    }

    const percent = percentOrIncome > 100 ? round((percentOrIncome / amount) * 100) : round(percentOrIncome);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      warnings.push(`Line ${sourceLineNumber}: derived percent "${percent}" out of range -> skipped.`);
      continue;
    }

    const patientName = cleanPatientName(rawName);
    if (!patientName) {
      warnings.push(`Line ${sourceLineNumber}: empty patient name after normalization -> skipped.`);
      continue;
    }

    const rawProcedure = columnMap.procedureName >= 0 ? String(cells[columnMap.procedureName] ?? '').trim() : '';
    const procedureName = pickProcedure(patientName, rawProcedure, options.defaultProcedure);
    const notes = columnMap.notes >= 0 ? String(cells[columnMap.notes] ?? '').trim() : '';
    const doctorIncome = round((amount * percent) / 100);

    drafts.push({
      ownerUid: options.uid,
      visitDate: currentDate,
      patientName,
      procedureName,
      amount: round(amount),
      percent,
      doctorIncome,
      notes
    });
  }

  return {
    drafts,
    warnings,
    delimiterName: delimiterInfo.name,
    hasHeader: firstLineIsHeader
  };
}

function parseJsonRows(rawText, options) {
  let parsedRoot;
  try {
    parsedRoot = JSON.parse(rawText.replace(/^\uFEFF/, '').trim());
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rows = Array.isArray(parsedRoot)
    ? parsedRoot
    : parsedRoot && typeof parsedRoot === 'object' && Array.isArray(parsedRoot.visits)
      ? parsedRoot.visits
      : null;

  if (!rows) {
    throw new Error('JSON root must be an array, or an object with "visits" array.');
  }

  const drafts = [];
  const warnings = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      warnings.push(`Row ${rowNumber}: invalid object -> skipped.`);
      continue;
    }

    const ownerUid = normalizeUid(options.uid) ?? normalizeUid(row.ownerUid);
    if (!ownerUid) {
      warnings.push(`Row ${rowNumber}: missing ownerUid (and no --uid override) -> skipped.`);
      continue;
    }

    const patientName = cleanPatientName(String(row.patientName ?? ''));
    if (!patientName) {
      warnings.push(`Row ${rowNumber}: empty patientName -> skipped.`);
      continue;
    }

    const visitDate = parseDate(row.visitDate, options.defaultYear);
    if (!visitDate) {
      warnings.push(`Row ${rowNumber}: invalid visitDate "${String(row.visitDate ?? '')}" -> skipped.`);
      continue;
    }

    const amount = parseNumber(row.amount);
    if (amount === null || amount <= 0) {
      warnings.push(`Row ${rowNumber}: invalid amount "${String(row.amount ?? '')}" -> skipped.`);
      continue;
    }

    const rawPercent = parseNumber(row.percent);
    const rawIncome = parseNumber(row.doctorIncome);

    if (rawPercent === null && rawIncome === null) {
      warnings.push(`Row ${rowNumber}: both percent and doctorIncome are missing -> skipped.`);
      continue;
    }

    let percent = rawPercent;
    if (percent === null && rawIncome !== null) {
      percent = round((rawIncome / amount) * 100);
    }

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      warnings.push(`Row ${rowNumber}: percent "${percent}" out of range -> skipped.`);
      continue;
    }

    const doctorIncome = rawIncome === null ? round((amount * percent) / 100) : round(rawIncome);
    const procedureName = pickProcedure(patientName, row.procedureName, options.defaultProcedure);
    const notes = String(row.notes ?? '').trim();

    drafts.push({
      ownerUid,
      visitDate,
      patientName,
      procedureName,
      amount: round(amount),
      percent: round(percent),
      doctorIncome,
      notes,
      createdAt: parseDateTime(row.createdAt),
      updatedAt: parseDateTime(row.updatedAt)
    });
  }

  return {
    drafts,
    warnings
  };
}

async function writeDrafts(db, collectionName, drafts) {
  const collectionRef = db.collection(collectionName);
  let created = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const draft of drafts) {
    const { ownerUid, createdAt, updatedAt, ...visitPayload } = draft;
    const ref = collectionRef.doc();
    batch.set(ref, {
      ...visitPayload,
      ownerUid,
      createdAt: createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: updatedAt ?? FieldValue.serverTimestamp()
    });
    batchSize += 1;

    if (batchSize >= MAX_BATCH_SIZE) {
      await batch.commit();
      created += batchSize;
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
    created += batchSize;
  }

  return created;
}

function printPreview(drafts) {
  const preview = drafts.slice(0, 5).map((item) => ({
    date: item.visitDate,
    patient: item.patientName,
    amount: item.amount,
    percent: item.percent,
    income: item.doctorIncome,
    procedure: item.procedureName
  }));

  if (!preview.length) {
    return;
  }

  console.log('\nPreview (first 5 rows):');
  console.table(preview);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.filePath) {
    throw new Error('Missing required argument: --file');
  }

  const rawText = await readFile(options.filePath, 'utf8');
  const inputFormat = detectInputFormat(options.filePath, rawText, options.inputFormat);

  if (inputFormat === 'csv' && !options.uid) {
    throw new Error('For CSV input provide --uid (JSON rows can carry ownerUid directly).');
  }

  const parsed = inputFormat === 'json' ? parseJsonRows(rawText, options) : parseRows(rawText, options);
  const uniqueUids = Array.from(new Set(parsed.drafts.map((row) => row.ownerUid).filter(Boolean)));

  const totalAmount = parsed.drafts.reduce((sum, row) => sum + row.amount, 0);
  const totalIncome = parsed.drafts.reduce((sum, row) => sum + row.doctorIncome, 0);

  console.log('Import summary');
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`File: ${options.filePath}`);
  console.log(`Input format: ${inputFormat}`);
  if (inputFormat === 'csv') {
    console.log(`Delimiter: ${parsed.delimiterName}`);
    console.log(`Header detected: ${parsed.hasHeader ? 'yes' : 'no'}`);
  }
  if (options.uid) {
    console.log(`UID override: ${options.uid}`);
  }
  console.log(`Target UIDs: ${uniqueUids.length ? uniqueUids.join(', ') : '(none)'}`);
  console.log(`Collection: ${options.collection}`);
  console.log(`Parsed rows: ${parsed.drafts.length}`);
  console.log(`Total amount: ${round(totalAmount)}`);
  console.log(`Total doctor income: ${round(totalIncome)}`);

  if (parsed.warnings.length > 0) {
    console.log(`Warnings: ${parsed.warnings.length}`);
    for (const warning of parsed.warnings.slice(0, 20)) {
      console.log(`  - ${warning}`);
    }
    if (parsed.warnings.length > 20) {
      console.log(`  ...and ${parsed.warnings.length - 20} more warnings.`);
    }
  }

  printPreview(parsed.drafts);

  if (!options.apply) {
    console.log('\nNo changes were written. Re-run with --apply to import.');
    return;
  }

  if (!parsed.drafts.length) {
    console.log('\nNothing to import.');
    return;
  }

  const db = await initFirestore(options.projectId, options.serviceAccountPath);
  const created = await writeDrafts(db, options.collection, parsed.drafts);
  console.log(`\nImported documents: ${created}`);
}

main().catch((error) => {
  console.error('Import failed:', error instanceof Error ? error.message : error);
  if (error instanceof Error && /Unable to detect a Project Id/i.test(error.message)) {
    console.error('Hint: run from project root with .firebaserc, or pass --project-id, or pass --service-account.');
  }
  process.exit(1);
});
