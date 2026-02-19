import { Visit } from '../models/visit.model';

export interface DailyInsight {
  date: string;
  visits: number;
  income: number;
}

export interface MonthlySummary {
  totalAmount: number;
  totalIncome: number;
  totalVisits: number;
  uniquePatients: number;
}

export interface DashboardVm {
  visits: Visit[];
  summary: MonthlySummary;
  topDays: DailyInsight[];
}

export type VisitsSort = 'dateDesc' | 'incomeDesc' | 'amountDesc' | 'patientAsc';

export function buildDashboardVm(visits: Visit[]): DashboardVm {
  const totalAmount = visits.reduce((sum, visit) => sum + visit.amount, 0);
  const totalIncome = visits.reduce((sum, visit) => sum + visit.doctorIncome, 0);

  return {
    visits,
    summary: {
      totalAmount,
      totalIncome,
      totalVisits: visits.length,
      uniquePatients: getUniquePatientsCount(visits)
    },
    topDays: getTopDays(visits)
  };
}

export function addMonths(month: string, delta: number, fallbackMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return fallbackMonth;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);

  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function filterVisits(visits: Visit[], query: string): Visit[] {
  if (!query) {
    return visits;
  }

  return visits.filter((visit) => {
    const searchData = [visit.patientName, visit.procedureName, visit.notes, visit.visitDate]
      .join(' ')
      .toLowerCase();

    return searchData.includes(query);
  });
}

export function sortVisits(visits: Visit[], sort: VisitsSort): Visit[] {
  const next = [...visits];

  switch (sort) {
    case 'incomeDesc':
      return next.sort((left, right) => right.doctorIncome - left.doctorIncome);
    case 'amountDesc':
      return next.sort((left, right) => right.amount - left.amount);
    case 'patientAsc':
      return next.sort((left, right) =>
        left.patientName.localeCompare(right.patientName, 'uk-UA')
      );
    case 'dateDesc':
    default:
      return next.sort((left, right) => {
        const byDate = right.visitDate.localeCompare(left.visitDate);
        if (byDate !== 0) {
          return byDate;
        }

        return (right.createdAt ?? 0) - (left.createdAt ?? 0);
      });
  }
}

export function calculateIncome(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(percent)) {
    return 0;
  }

  return Math.round((amount * percent) / 100 * 100) / 100;
}

function getUniquePatientsCount(visits: Visit[]): number {
  const uniqueNames = new Set(visits.map((visit) => visit.patientName.trim().toLowerCase()));

  return uniqueNames.size;
}

function getTopDays(visits: Visit[]): DailyInsight[] {
  const grouped = new Map<string, DailyInsight>();

  for (const visit of visits) {
    const existing = grouped.get(visit.visitDate) ?? {
      date: visit.visitDate,
      visits: 0,
      income: 0
    };

    existing.visits += 1;
    existing.income += visit.doctorIncome;

    grouped.set(visit.visitDate, existing);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.income - left.income)
    .slice(0, 5);
}
