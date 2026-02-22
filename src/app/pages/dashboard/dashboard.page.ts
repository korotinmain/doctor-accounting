import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { User } from 'firebase/auth';
import { map, shareReplay } from 'rxjs';

import { ActionPanelComponent } from '../../components/action-panel/action-panel.component';
import { DashboardStatsComponent } from '../../components/dashboard-stats/dashboard-stats.component';
import { PeriodControlBarComponent } from '../../components/period-control-bar/period-control-bar.component';
import { ReportHeaderComponent } from '../../components/report-header/report-header.component';
import { SideStackComponent } from '../../components/side-stack/side-stack.component';
import { VisitDialogComponent } from '../../components/visit-dialog/visit-dialog.component';
import { VisitsLedgerComponent } from '../../components/visits-ledger/visits-ledger.component';
import { AuthSessionService } from '../../services/auth-session.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { VisitsDashboardFacade } from '../../services/visits-dashboard.facade';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSnackBarModule,
    ReportHeaderComponent,
    PeriodControlBarComponent,
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
  readonly userView$ = this.authSession.user$.pipe(
    map((user) => ({
      displayName: this.resolveDisplayName(user),
      email: user?.email ?? '',
      photoUrl: user?.photoURL ?? ''
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    public readonly facade: VisitsDashboardFacade,
    public readonly authSession: AuthSessionService,
    private readonly confirmDialog: ConfirmDialogService
  ) {}

  async logout(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Вийти з акаунту?',
      message: this.facade.hasUnsavedChanges
        ? 'У вас є незбережені зміни у формі. Після виходу ці дані буде втрачено.'
        : 'Сесію буде завершено на цьому пристрої.',
      confirmText: 'Вийти',
      cancelText: 'Залишитись',
      tone: 'danger',
      icon: 'logout'
    });

    if (!confirmed) {
      return;
    }

    this.facade.resetStateForSignOut();
    await this.authSession.signOut();
  }

  private resolveDisplayName(user: User | null): string {
    if (!user) {
      return 'Користувач';
    }

    const displayName = user.displayName?.trim();
    if (displayName) {
      return displayName;
    }

    const email = user.email ?? '';
    return email.split('@')[0] || 'Користувач';
  }
}
