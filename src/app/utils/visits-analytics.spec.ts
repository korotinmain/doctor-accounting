import { Visit } from '../models/visit.model';
import {
  addMonths,
  buildDashboardVm,
  calculateIncome,
  filterVisits,
  sortVisits
} from './visits-analytics';

describe('visits-analytics', () => {
  const visits: Visit[] = [
    {
      id: '1',
      visitDate: '2026-02-19',
      patientName: 'Коротін Д.С.',
      procedureName: 'Консультація',
      amount: 1150,
      percent: 30,
      doctorIncome: 345,
      notes: 'Первинний візит',
      createdAt: 2
    },
    {
      id: '2',
      visitDate: '2026-02-19',
      patientName: 'Іваненко П.П.',
      procedureName: 'Лікування',
      amount: 2000,
      percent: 25,
      doctorIncome: 500,
      notes: '',
      createdAt: 1
    },
    {
      id: '3',
      visitDate: '2026-02-18',
      patientName: 'коротін д.с.',
      procedureName: 'Огляд',
      amount: 1000,
      percent: 20,
      doctorIncome: 200,
      notes: 'Повторний',
      createdAt: 3
    }
  ];

  it('buildDashboardVm should aggregate summary values', () => {
    const vm = buildDashboardVm(visits);

    expect(vm.summary.totalAmount).toBe(4150);
    expect(vm.summary.totalIncome).toBe(1045);
    expect(vm.summary.totalVisits).toBe(3);
    expect(vm.summary.uniquePatients).toBe(2);
  });

  it('calculateIncome should return 0 for invalid numbers', () => {
    expect(calculateIncome(Number.NaN, 30)).toBe(0);
    expect(calculateIncome(1000, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('filterVisits should search through patient/procedure/notes/date', () => {
    expect(filterVisits(visits, 'повторний').length).toBe(1);
    expect(filterVisits(visits, '2026-02-19').length).toBe(2);
    expect(filterVisits(visits, '').length).toBe(3);
  });

  it('sortVisits should support patient and date sorting', () => {
    const byPatient = sortVisits(visits, 'patientAsc');
    expect(byPatient[0].patientName).toBe('Іваненко П.П.');

    const byDate = sortVisits(visits, 'dateDesc');
    expect(byDate[0].id).toBe('1');
    expect(byDate[1].id).toBe('2');
    expect(byDate[2].id).toBe('3');
  });

  it('addMonths should shift month and fallback on invalid input', () => {
    expect(addMonths('2026-02', -1, '2026-02')).toBe('2026-01');
    expect(addMonths('2026-12', 1, '2026-02')).toBe('2027-01');
    expect(addMonths('bad-input', 1, '2026-02')).toBe('2026-02');
  });
});
