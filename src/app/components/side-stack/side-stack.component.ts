import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { Visit } from '../../models/visit.model';
import { AuthSessionService } from '../../services/auth-session.service';
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

@Component({
  selector: 'app-side-stack',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './side-stack.component.html',
  styleUrls: ['./side-stack.component.scss']
})
export class SideStackComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);

  @Input() monthLoading = false;
  @Input() dailyStats: DailyInsight[] = [];
  @Input() visits: Visit[] = [];
  @Input() selectedMonth = '';

  selectedDay: string | null = null;

  ngOnInit(): void {
    this.selectedDay = this.todayIsoDate;
  }

  readonly weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

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

  get activeStatsDate(): string {
    return this.selectedDay ?? this.todayIsoDate;
  }

  get activeStatsLabel(): string {
    const iso = this.activeStatsDate;
    const date = new Date(iso + 'T00:00:00');
    return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(date);
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  get todayStats(): DailyInsight {
    const iso = this.activeStatsDate;
    return (
      this.dailyStats.find((day) => day.date === iso) ?? {
        date: iso,
        visits: 0,
        doctorIncome: 0,
        totalAmount: 0
      }
    );
  }

  get calendarMonthLabel(): string {
    const { year, month } = this.resolvedPeriod;
    const value = new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month - 1, 1));
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  get calendarMonthTitle(): string {
    const { year, month } = this.resolvedPeriod;
    return new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(new Date(year, month - 1, 1)).toUpperCase();
  }

  get calendarCells(): CalendarCell[] {
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
    const emphasisDay = isTodayInPeriod ? todayDay : this.getMostActiveDay(activeByDay);

    const cells: CalendarCell[] = Array.from({ length: leadingEmpty }, () => ({ type: 'empty' as const }));
    for (let day = 1; day <= daysInMonth; day += 1) {
      const insight = activeByDay.get(day);
      cells.push({
        type: 'day',
        day,
        visits: insight?.visits ?? 0,
        hasVisits: Boolean(insight && insight.visits > 0),
        isToday: isTodayInPeriod && day === todayDay,
        isEmphasis: emphasisDay > 0 && day === emphasisDay
      });
    }
    return cells;
  }

  exportData(): void {
    if (typeof document === 'undefined') return;

    const { year, month } = this.resolvedPeriod;
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = this.visits
      .filter((visit) => visit.visitDate.startsWith(`${monthPrefix}-`))
      .sort((left, right) => left.visitDate.localeCompare(right.visitDate));

    if (!rows.length) return;

    // Group by date
    const groups = new Map<string, typeof rows>();
    for (const visit of rows) {
      const existing = groups.get(visit.visitDate) ?? [];
      existing.push(visit);
      groups.set(visit.visitDate, existing);
    }

    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const sep = ';';
    const lines: string[] = [];

    let grandAmount = 0;
    let grandIncome = 0;

    for (const [date, dayVisits] of groups.entries()) {
      const shortDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(
        new Date(date + 'T00:00:00')
      );

      // Day header
      lines.push([q('Дата'), q('ПІБ'), q('Сума'), q('%')].join(sep));

      let dayAmount = 0;
      let dayIncome = 0;
      let firstRow = true;

      for (const visit of dayVisits) {
        dayAmount += visit.amount;
        dayIncome += visit.doctorIncome;
        lines.push(
          [firstRow ? q(shortDate) : q(''), q(visit.patientName), q(visit.amount), q(visit.doctorIncome)].join(sep)
        );
        firstRow = false;
      }

      // Day subtotal
      lines.push([q(''), q(''), q(dayAmount), q(dayIncome)].join(sep));
      // Empty separator row
      lines.push('');

      grandAmount += dayAmount;
      grandIncome += dayIncome;
    }

    // Grand total
    lines.push([q('СУМА'), q(''), q(grandAmount), q(grandIncome)].join(sep));

    // BOM for Excel UTF-8 detection
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const rawName =
      this.authSession.currentUser?.displayName ?? this.authSession.currentUser?.email?.split('@')[0] ?? 'export';
    const safeName = rawName
      .replace(/[^\w\u0400-\u04FF\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    anchor.download = `${safeName}_${monthPrefix}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  printReport(): void {
    if (typeof window === 'undefined') return;
    window.print();
  }

  visitLabel(value: number): string {
    return `${value} ${value === 1 ? 'візит' : 'візити'}`;
  }

  trackByCell(index: number): number {
    return index;
  }

  private get todayIsoDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private get resolvedPeriod(): { year: number; month: number } {
    if (/^\d{4}-\d{2}$/.test(this.selectedMonth)) {
      const [year, month] = this.selectedMonth.split('-').map(Number);
      return { year, month };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  private getMostActiveDay(activeByDay: Map<number, DailyInsight>): number {
    let day = 0;
    let visits = 0;
    for (const [key, value] of activeByDay.entries()) {
      if (value.visits > visits) {
        visits = value.visits;
        day = key;
      }
    }
    return day;
  }
}
