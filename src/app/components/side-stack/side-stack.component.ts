import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { Visit } from '../../models/visit.model';
import { DailyInsight } from '../../utils/visits-analytics';

type CalendarCell =
  | { type: 'empty' }
  | {
      type: 'day';
      day: number;
      isToday: boolean;
      hasVisits: boolean;
      visits: number;
      isEmphasis: boolean;
    };

export interface CalendarWeek {
  cells: CalendarCell[];
  weekTotal: number;
}

@Component({
  selector: 'app-side-stack',
  standalone: true,
  imports: [NgIf, NgFor, CurrencyPipe, MatCardModule, MatIconModule],
  templateUrl: './side-stack.component.html',
  styleUrls: ['./side-stack.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideStackComponent implements OnInit {
  @Input() monthLoading = false;
  @Input() dailyStats: DailyInsight[] = [];
  @Input() visits: Visit[] = [];
  @Input() selectedMonth = '';

  @Input() exportFormat: 'csv' | 'excel' = 'csv';

  @Output() exportRequested = new EventEmitter<void>();

  selectedDay: string | null = null;

  ngOnInit(): void {
    this.selectedDay = this.todayIsoDate;
  }

  readonly weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  // ── Day selection ────────────────────────────────────────────────────

  selectDay(day: number): void {
    const { year, month } = this.resolvedPeriod;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.selectedDay = this.selectedDay === iso ? null : iso;
  }

  isDaySelected(day: number): boolean {
    const { year, month } = this.resolvedPeriod;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.selectedDay === iso;
  }

  getDayTotal(day: number): number {
    const { year, month } = this.resolvedPeriod;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.dailyStats.find((d) => d.date === iso)?.totalAmount ?? 0;
  }

  // ── Month label ──────────────────────────────────────────────────────

  get calendarMonthLabel(): string {
    const { year, month } = this.resolvedPeriod;
    const value = new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month - 1, 1));
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  // ── Stats card ───────────────────────────────────────────────────────

  get activeDaysCount(): number {
    return this.dailyStats.filter((d) => d.visits > 0).length;
  }

  get bestProfitableDay(): string {
    if (!this.dailyStats.length) return '—';
    const best = this.dailyStats.reduce((a, b) => (b.doctorIncome > a.doctorIncome ? b : a));
    const date = new Date(best.date + 'T00:00:00');
    return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(date);
  }

  get avgIncomePercent(): number {
    const totalAmount = this.visits.reduce((s, v) => s + v.amount, 0);
    const totalIncome = this.visits.reduce((s, v) => s + v.doctorIncome, 0);
    if (!totalAmount) return 0;
    return Math.round((totalIncome / totalAmount) * 100);
  }

  get topProcedure(): { name: string; percent: number } {
    if (!this.visits.length) return { name: '—', percent: 0 };
    const byProc = new Map<string, number>();
    for (const v of this.visits) {
      byProc.set(v.procedureName, (byProc.get(v.procedureName) ?? 0) + v.amount);
    }
    const total = this.visits.reduce((s, v) => s + v.amount, 0);
    let topName = '';
    let topAmt = 0;
    for (const [name, amt] of byProc.entries()) {
      if (amt > topAmt) {
        topAmt = amt;
        topName = name;
      }
    }
    return { name: topName, percent: total ? Math.round((topAmt / total) * 100) : 0 };
  }

  // ── Calendar ─────────────────────────────────────────────────────────

  get calendarWeeks(): CalendarWeek[] {
    const cells = this.calendarCells;
    const weeks: CalendarWeek[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const weekCells: CalendarCell[] = cells.slice(i, i + 7);
      while (weekCells.length < 7) weekCells.push({ type: 'empty' });
      const weekTotal = weekCells.reduce((sum, cell) => {
        if (cell.type !== 'day') return sum;
        return sum + this.getDayTotal(cell.day);
      }, 0);
      weeks.push({ cells: weekCells, weekTotal });
    }
    return weeks;
  }

  printReport(): void {
    if (typeof window === 'undefined') return;
    window.print();
  }

  trackByCell(index: number): number {
    return index;
  }

  trackByWeek(index: number): number {
    return index;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private get calendarCells(): CalendarCell[] {
    const { year, month } = this.resolvedPeriod;
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const leadingEmpty = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const activeByDay = new Map<number, DailyInsight>();

    for (const day of this.dailyStats) {
      if (!day.date.startsWith(`${monthPrefix}-`)) continue;
      const dayNumber = Number(day.date.slice(-2));
      if (!Number.isInteger(dayNumber)) continue;
      activeByDay.set(dayNumber, day);
    }

    const today = new Date();
    const isTodayInPeriod = today.getFullYear() === year && today.getMonth() + 1 === month;
    const todayDay = today.getDate();

    const cells: CalendarCell[] = Array.from({ length: leadingEmpty }, () => ({ type: 'empty' as const }));
    for (let day = 1; day <= daysInMonth; day += 1) {
      const insight = activeByDay.get(day);
      cells.push({
        type: 'day',
        day,
        visits: insight?.visits ?? 0,
        hasVisits: Boolean(insight && insight.visits > 0),
        isToday: isTodayInPeriod && day === todayDay,
        isEmphasis: false
      });
    }
    return cells;
  }

  private get todayIsoDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  get resolvedPeriod(): { year: number; month: number } {
    if (/^\d{4}-\d{2}$/.test(this.selectedMonth)) {
      const [year, month] = this.selectedMonth.split('-').map(Number);
      return { year, month };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}
