import { CurrencyPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexChart, ApexFill, ApexStroke, ApexTooltip } from 'ng-apexcharts';

import { MonthlyPoint, MonthlySummary, calcTrendPercent } from '../../utils/visits-analytics';

type ColorKey = 'green' | 'blue' | 'orange' | 'violet';
type ValueFormat = 'currency' | 'count';

interface StatCard {
  label: string;
  icon: string;
  colorKey: ColorKey;
  value: number;
  valueFormat: ValueFormat;
  trendPercent: number | null;
  trendLabel: string;
  hasPrevData: boolean;
  chartSeries: number[];
  chartColor: string;
}

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, CurrencyPipe, MatIconModule, NgApexchartsModule],
  templateUrl: './dashboard-stats.component.html',
  styleUrls: ['./dashboard-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardStatsComponent {
  @Input({ required: true }) summary!: MonthlySummary;
  @Input() history: MonthlyPoint[] = [];
  @Input() monthLoading = false;

  readonly sparklineChart: ApexChart = {
    type: 'area',
    sparkline: { enabled: true },
    height: 44,
    width: 100,
    animations: { enabled: false }
  } as ApexChart;

  readonly sparklineStroke: ApexStroke = { curve: 'smooth', width: 2 };

  readonly sparklineFill: ApexFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] }
  };

  readonly sparklineTooltip: ApexTooltip = { enabled: false };

  get cards(): StatCard[] {
    const s = this.summary;
    const prev = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    const avgCheck = s.totalVisits > 0 ? s.totalAmount / s.totalVisits : 0;
    const prevAvgCheck = prev && prev.visits > 0 ? prev.amount / prev.visits : 0;

    return [
      {
        label: 'Дохід лікаря',
        icon: 'power_settings_new',
        colorKey: 'green',
        value: s.totalIncome,
        valueFormat: 'currency',
        trendPercent: prev && prev.income > 0 ? calcTrendPercent(s.totalIncome, prev.income) : null,
        trendLabel: 'від минулого місяця',
        hasPrevData: prev !== null && prev.income > 0,
        chartSeries: [...this.history.map((h) => h.income), s.totalIncome],
        chartColor: '#0b9185'
      },
      {
        label: 'Середній чек',
        icon: 'credit_card',
        colorKey: 'blue',
        value: avgCheck,
        valueFormat: 'currency',
        trendPercent: prev && prev.visits > 0 ? calcTrendPercent(avgCheck, prevAvgCheck) : null,
        trendLabel: 'від минулого місяця',
        hasPrevData: prev !== null && prev.visits > 0,
        chartSeries: [...this.history.map((h) => (h.visits > 0 ? h.amount / h.visits : 0)), avgCheck],
        chartColor: '#3b67d6'
      },
      {
        label: 'Загальна каса',
        icon: 'account_balance_wallet',
        colorKey: 'orange',
        value: s.totalAmount,
        valueFormat: 'currency',
        trendPercent: prev && prev.amount > 0 ? calcTrendPercent(s.totalAmount, prev.amount) : null,
        trendLabel: 'від минулого місяця',
        hasPrevData: prev !== null && prev.amount > 0,
        chartSeries: [...this.history.map((h) => h.amount), s.totalAmount],
        chartColor: '#d9640c'
      },
      {
        label: 'Прийоми',
        icon: 'supervisor_account',
        colorKey: 'violet',
        value: s.totalVisits,
        valueFormat: 'count',
        trendPercent: prev && prev.visits > 0 ? calcTrendPercent(s.totalVisits, prev.visits) : null,
        trendLabel: 'від минулого місяця',
        hasPrevData: prev !== null && prev.visits > 0,
        chartSeries: [...this.history.map((h) => h.visits), s.totalVisits],
        chartColor: '#b02fce'
      }
    ];
  }

  formatTrend(percent: number): string {
    return percent >= 0 ? `+${percent}%` : `${percent}%`;
  }
}
