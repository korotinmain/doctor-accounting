import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { MonthlySummary } from '../../utils/visits-analytics';

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './dashboard-stats.component.html',
  styleUrls: ['./dashboard-stats.component.scss']
})
export class DashboardStatsComponent {
  @Input({ required: true }) summary!: MonthlySummary;
  @Input() monthLoading = false;
}
