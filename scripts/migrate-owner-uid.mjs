#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';

const DEFAULT_COLLECTION = 'visits';
const DEFAULT_PAGE_SIZE = 400;

function printUsage() {
  console.log(
    `\nUsage:\n  node scripts/migrate-owner-uid.mjs [options]\n\nOptions:\n  --apply                       Apply updates (default is dry-run)\n  --collection=<name>           Firestore collection (default: visits)\n  --project-id=<id>             Firebase project id (optional)\n  --service-account=<path>      Path to service account JSON (optional)\n  --all-to-uid=<uid>            Assign all ownerless docs to this uid\n  --map-file=<path>             JSON file with uid mapping by docId\n  --page-size=<n>               Docs per page (default: 400, max: 500)\n  --limit=<n>                   Process at most N ownerless docs\n  --help                        Show this message\n\nMap file formats supported:\n  1) { "defaultUid": "uid_1", "byDocId": { "docA": "uid_2" } }\n  2) { "docA": "uid_2", "docB": "uid_3" }\n\nExamples:\n  node scripts/migrate-owner-uid.mjs --all-to-uid=abc123\n  node scripts/migrate-owner-uid.mjs --apply --all-to-uid=abc123\n  node scripts/migrate-owner-uid.mjs --apply --map-file=./scripts/owner-map.json\n`
  );
}

function parseArgs(argv) {
  const options = {
    apply: false,
    collection: DEFAULT_COLLECTION,
    projectId: '',
    serviceAccountPath: '',
    allToUid: '',
    mapFilePath: '',
    pageSize: DEFAULT_PAGE_SIZE,
    limit: 0
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

    if (arg.startsWith('--collection=')) {
      options.collection = arg.split('=')[1] || DEFAULT_COLLECTION;
      continue;
    }

    if (arg.startsWith('--project-id=')) {
      options.projectId = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--service-account=')) {
      options.serviceAccountPath = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--all-to-uid=')) {
      options.allToUid = (arg.split('=')[1] || '').trim();
      continue;
    }

    if (arg.startsWith('--map-file=')) {
      options.mapFilePath = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--page-size=')) {
      const parsed = Number(arg.split('=')[1]);
      options.pageSize = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 500) : DEFAULT_PAGE_SIZE;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.split('=')[1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizeUid(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function loadMapFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Map file must be a JSON object.');
  }

  const hasStructuredShape =
    Object.prototype.hasOwnProperty.call(parsed, 'byDocId') ||
    Object.prototype.hasOwnProperty.call(parsed, 'defaultUid');

  if (hasStructuredShape) {
    const byDocIdRaw =
      parsed.byDocId && typeof parsed.byDocId === 'object' && !Array.isArray(parsed.byDocId) ? parsed.byDocId : {};
    const byDocId = Object.fromEntries(
      Object.entries(byDocIdRaw)
        .map(([docId, uid]) => [docId, normalizeUid(uid)])
        .filter(([, uid]) => Boolean(uid))
    );

    return {
      defaultUid: normalizeUid(parsed.defaultUid),
      byDocId
    };
  }

  const byDocId = Object.fromEntries(
    Object.entries(parsed)
      .map(([docId, uid]) => [docId, normalizeUid(uid)])
      .filter(([, uid]) => Boolean(uid))
  );

  return {
    defaultUid: null,
    byDocId
  };
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

function getTargetUid(docId, options, mapping) {
  if (mapping?.byDocId?.[docId]) {
    return mapping.byDocId[docId];
  }

  if (options.allToUid) {
    return options.allToUid;
  }

  if (mapping?.defaultUid) {
    return mapping.defaultUid;
  }

  return null;
}

async function initFirestore(projectId, serviceAccountPath) {
  const serviceAccount = await loadServiceAccount(serviceAccountPath);

  if (!getApps().length) {
    if (serviceAccount) {
      const inferredProjectId = projectId || serviceAccount.project_id;
      initializeApp({
        credential: cert(serviceAccount),
        ...(inferredProjectId ? { projectId: inferredProjectId } : {})
      });
    } else {
      initializeApp(projectId ? { projectId } : undefined);
    }
  }

  return getFirestore();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.allToUid && !options.mapFilePath) {
    throw new Error('Provide either --all-to-uid or --map-file.');
  }

  const mapping = options.mapFilePath ? await loadMapFile(options.mapFilePath) : null;

  const db = await initFirestore(options.projectId, options.serviceAccountPath);
  const collectionRef = db.collection(options.collection);

  let scanned = 0;
  let alreadyOwned = 0;
  let ownerless = 0;
  let assigned = 0;
  let skippedNoUid = 0;
  let updated = 0;
  let lastDocId = null;

  let batch = db.batch();
  let batchSize = 0;

  while (true) {
    let query = collectionRef.orderBy(FieldPath.documentId()).limit(options.pageSize);
    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      scanned += 1;

      const data = doc.data() ?? {};
      const existingOwner = normalizeUid(data.ownerUid);

      if (existingOwner) {
        alreadyOwned += 1;
        continue;
      }

      ownerless += 1;

      if (options.limit > 0 && assigned >= options.limit) {
        continue;
      }

      const targetUid = getTargetUid(doc.id, options, mapping);
      if (!targetUid) {
        skippedNoUid += 1;
        continue;
      }

      assigned += 1;

      if (!options.apply) {
        continue;
      }

      batch.update(doc.ref, {
        ownerUid: targetUid,
        updatedAt: FieldValue.serverTimestamp()
      });
      batchSize += 1;

      if (batchSize >= options.pageSize) {
        await batch.commit();
        updated += batchSize;
        batch = db.batch();
        batchSize = 0;
      }
    }

    lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  if (options.apply && batchSize > 0) {
    await batch.commit();
    updated += batchSize;
  }

  console.log('Migration summary');
  console.log(`Collection: ${options.collection}`);
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Scanned docs: ${scanned}`);
  console.log(`Already owned: ${alreadyOwned}`);
  console.log(`Ownerless docs: ${ownerless}`);
  console.log(`Assignable docs: ${assigned}`);
  console.log(`Skipped (no uid mapping): ${skippedNoUid}`);
  console.log(`Updated docs: ${updated}`);

  if (!options.apply) {
    console.log('No changes were written. Re-run with --apply to persist updates.');
  }
}

main().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
