import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { User } from 'firebase/auth';
import { map, shareReplay } from 'rxjs';

import {
  ActionPanelComponent,
  DashboardStatsComponent,
  PeriodControlBarComponent,
  ReportHeaderComponent,
  SideStackComponent,
  VisitDialogComponent,
  VisitsLedgerComponent
} from '../../components';
import { AuthSessionService, ConfirmDialogService, VisitsDashboardFacade } from '../../services';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    NgIf,
    AsyncPipe,
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
  providers: [VisitsDashboardFacade],
  changeDetection: ChangeDetectionStrategy.OnPush
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
