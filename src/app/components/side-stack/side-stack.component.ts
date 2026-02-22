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

  @Output() exportRequested = new EventEmitter<void>();

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
