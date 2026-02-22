import { CurrencyPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { MonthlySummary } from '../../utils/visits-analytics';

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [NgIf, CurrencyPipe, MatCardModule, MatIconModule],
  templateUrl: './dashboard-stats.component.html',
  styleUrls: ['./dashboard-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardStatsComponent {
  @Input({ required: true }) summary!: MonthlySummary;
  @Input() monthLoading = false;
}
