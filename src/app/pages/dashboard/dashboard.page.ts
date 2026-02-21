import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ActionPanelComponent } from '../../components/action-panel/action-panel.component';
import { DashboardStatsComponent } from '../../components/dashboard-stats/dashboard-stats.component';
import { ReportHeaderComponent } from '../../components/report-header/report-header.component';
import { SideStackComponent } from '../../components/side-stack/side-stack.component';
import { VisitDialogComponent } from '../../components/visit-dialog/visit-dialog.component';
import { VisitsLedgerComponent } from '../../components/visits-ledger/visits-ledger.component';
import { AuthSessionService } from '../../services/auth-session.service';
import { VisitsDashboardFacade } from '../../services/visits-dashboard.facade';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSnackBarModule,
    ReportHeaderComponent,
    DashboardStatsComponent,
    ActionPanelComponent,
    SideStackComponent,
    VisitsLedgerComponent,
    VisitDialogComponent
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  providers: [VisitsDashboardFacade]
})
export class DashboardPageComponent {
  constructor(
    public readonly facade: VisitsDashboardFacade,
    public readonly authSession: AuthSessionService
  ) {}
}
