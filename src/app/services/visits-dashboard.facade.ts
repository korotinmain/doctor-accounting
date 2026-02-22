import { Injectable, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Auth, authState } from '@angular/fire/auth';
import { catchError, combineLatest, map, merge, of, shareReplay, startWith, switchMap } from 'rxjs';

import { LedgerVm } from '../models/ledger-view.model';
import { Visit, VisitDraft } from '../models/visit.model';
import {
  MonthlyPoint,
  VisitsSort,
  addMonths,
  buildDashboardVm,
  calculateIncome,
  filterVisits,
  sortVisits
} from '../utils/visits-analytics';
import { ConfirmDialogService } from './confirm-dialog.service';
import { VisitsService } from './visits.service';

type ReportPeriod = {
  year: number;
  month: number;
};

@Injectable()
export class VisitsDashboardFacade {
  readonly procedureOptions = ['Консультація', 'Операція', 'Інше'];
  readonly percentQuickOptions = [10, 20, 30, 40, 50];

  readonly monthControl = this.formBuilder.nonNullable.control(this.getCurrentMonth(), Validators.required);

  readonly searchControl = this.formBuilder.nonNullable.control('');
  readonly sortControl = this.formBuilder.nonNullable.control<VisitsSort>('dateDesc');

  readonly visitForm = this.formBuilder.group({
    visitDate: this.formBuilder.nonNullable.control(this.getTodayDate(), Validators.required),
    patientName: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    procedureName: this.formBuilder.nonNullable.control('Консультація', [
      Validators.required,
      Validators.maxLength(120)
    ]),
    amount: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(1)]),
    percent: this.formBuilder.nonNullable.control(30, [Validators.required, Validators.min(0), Validators.max(100)]),
    notes: this.formBuilder.nonNullable.control('')
  });

  readonly user$ = authState(this.auth).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly projectedIncome$ = this.visitForm.valueChanges.pipe(
    startWith(this.visitForm.getRawValue()),
    map((formValue) => calculateIncome(Number(formValue.amount), Number(formValue.percent)))
  );

  readonly monthVisits$ = combineLatest([
    this.monthControl.valueChanges.pipe(startWith(this.monthControl.value)),
    this.user$
  ]).pipe(
    switchMap(([month, user]) => {
      if (!user) {
        this.authErrorMessage.set('Увійдіть в акаунт, щоб працювати з журналом.');
        return of<Visit[]>([]);
      }

      this.authErrorMessage.set(null);

      return this.visitsService.getVisitsByMonth(month, user.uid).pipe(
        catchError((error) => {
          this.notifyError('Не вдалося завантажити записи за місяць', error);
          return of<Visit[]>([]);
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly historyPoints$ = combineLatest([
    this.monthControl.valueChanges.pipe(startWith(this.monthControl.value)),
    this.user$
  ]).pipe(
    switchMap(([month, user]) => {
      if (!user) return of<MonthlyPoint[]>([]);
      const months = Array.from({ length: 6 }, (_, i) => addMonths(month, -(6 - i), month));
      return combineLatest(
        months.map((m) =>
          this.visitsService.getVisitsByMonth(m, user.uid).pipe(
            map(
              (arr) =>
                ({
                  month: m,
                  income: arr.reduce((s, v) => s + v.doctorIncome, 0),
                  amount: arr.reduce((s, v) => s + v.amount, 0),
                  visits: arr.length,
                  patients: new Set(arr.map((v) => v.patientName.trim().toLowerCase())).size
                }) satisfies MonthlyPoint
            ),
            catchError(() => of<MonthlyPoint>({ month: m, income: 0, amount: 0, visits: 0, patients: 0 }))
          )
        )
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly monthLoading$ = merge(
    this.monthControl.valueChanges.pipe(
      startWith(this.monthControl.value),
      map(() => true)
    ),
    this.user$.pipe(map(() => true)),
    this.monthVisits$.pipe(map(() => false))
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly vm$ = combineLatest([
    this.monthVisits$,
    this.monthControl.valueChanges.pipe(startWith(this.monthControl.value)),
    this.historyPoints$.pipe(startWith([] as MonthlyPoint[]))
  ]).pipe(
    map(([visits, month, history]) => buildDashboardVm(visits, month, history)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly ledgerVm$ = combineLatest([
    this.vm$,
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map((query) => query.trim().toLowerCase())
    ),
    this.sortControl.valueChanges.pipe(startWith(this.sortControl.value))
  ]).pipe(
    map(([vm, query, sort]) => {
      const filteredVisits = filterVisits(vm.visits, query);
      const sortedVisits = sortVisits(filteredVisits, sort);

      return {
        visits: sortedVisits,
        hasQuery: query.length > 0
      } satisfies LedgerVm;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly editedVisitId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formDialogOpen = signal(false);
  readonly authErrorMessage = signal<string | null>(null);

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly visitsService: VisitsService,
    private readonly snackBar: MatSnackBar,
    private readonly auth: Auth,
    private readonly confirmDialog: ConfirmDialogService
  ) {}

  get selectedMonthLabel(): string {
    const period = this.selectedPeriod;
    if (!period) {
      return '';
    }

    return new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(period.year, period.month - 1, 1));
  }

  get selectedPeriod(): ReportPeriod | null {
    const month = this.monthControl.value;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return null;
    }

    const [year, monthNumber] = month.split('-').map(Number);
    return {
      year,
      month: monthNumber
    };
  }

  get isCurrentMonthSelected(): boolean {
    return this.monthControl.value === this.getCurrentMonth();
  }

  get hasUnsavedChanges(): boolean {
    return this.formDialogOpen() && this.visitForm.dirty;
  }

  shiftMonth(delta: number): void {
    const month = this.monthControl.value;
    const next = addMonths(month, delta, this.getCurrentMonth());
    this.monthControl.setValue(next);
  }

  goCurrentMonth(): void {
    this.monthControl.setValue(this.getCurrentMonth());
  }

  async submitVisit(): Promise<void> {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return;
    }

    const draft = this.toDraft();
    this.saving.set(true);

    try {
      if (this.editedVisitId()) {
        await this.visitsService.updateVisit(this.editedVisitId()!, draft);
        this.snackBar.open('Запис оновлено', 'OK', { duration: 2400 });
      } else {
        await this.visitsService.createVisit(draft);
        this.snackBar.open('Запис додано', 'OK', { duration: 2400 });
      }

      this.resetForm();
      this.formDialogOpen.set(false);
    } catch (error) {
      this.notifyError('Не вдалося зберегти запис', error);
    } finally {
      this.saving.set(false);
    }
  }

  editVisit(visit: Visit): void {
    this.editedVisitId.set(visit.id);

    this.visitForm.reset({
      visitDate: this.parseVisitDate(visit.visitDate),
      patientName: visit.patientName,
      procedureName: this.normalizeProcedureName(visit.procedureName),
      amount: visit.amount,
      percent: visit.percent,
      notes: visit.notes
    });
    this.formDialogOpen.set(true);
  }

  cancelEdit(): void {
    this.formDialogOpen.set(false);
    this.resetForm();
  }

  openCreateDialog(): void {
    this.resetForm();
    this.formDialogOpen.set(true);
  }

  closeVisitDialog(): void {
    if (this.saving()) {
      return;
    }

    this.cancelEdit();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  resetStateForSignOut(): void {
    this.formDialogOpen.set(false);
    this.saving.set(false);
    this.deletingId.set(null);
    this.authErrorMessage.set(null);
    this.searchControl.setValue('', { emitEvent: false });
    this.sortControl.setValue('dateDesc', { emitEvent: false });
    this.monthControl.setValue(this.getCurrentMonth(), { emitEvent: false });
    this.resetForm();
  }

  async deleteVisit(visit: Visit): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Видалити запис?',
      message: `Запис для ${visit.patientName} (${visit.visitDate}) буде видалено без можливості відновлення.`,
      confirmText: 'Видалити',
      cancelText: 'Скасувати',
      tone: 'danger',
      icon: 'delete_outline'
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(visit.id);

    try {
      await this.visitsService.deleteVisit(visit.id);
      this.snackBar.open('Запис видалено', 'OK', { duration: 2400 });

      if (this.editedVisitId() === visit.id) {
        this.resetForm();
      }
    } catch (error) {
      this.notifyError('Не вдалося видалити запис', error);
    } finally {
      this.deletingId.set(null);
    }
  }

  exportVisitsData(visits: Visit[]): void {
    if (typeof document === 'undefined') return;

    const monthPrefix = this.monthControl.value;
    const rows = visits
      .filter((visit) => visit.visitDate.startsWith(`${monthPrefix}-`))
      .sort((left, right) => left.visitDate.localeCompare(right.visitDate));

    if (!rows.length) return;

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

      lines.push([q(''), q(''), q(dayAmount), q(dayIncome)].join(sep));
      lines.push('');
      grandAmount += dayAmount;
      grandIncome += dayIncome;
    }

    lines.push([q('ЗАГАЛОМ'), q(''), q(grandAmount), q(grandIncome)].join(sep));

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const rawName = this.auth.currentUser?.displayName ?? this.auth.currentUser?.email?.split('@')[0] ?? 'export';
    const safeName = rawName
      .replace(/[^\w\u0400-\u04FF\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    anchor.download = `${safeName}_${monthPrefix}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private toDraft(): VisitDraft {
    const formValue = this.visitForm.getRawValue();
    const visitDate = formValue.visitDate instanceof Date ? formValue.visitDate : this.getTodayDate();

    return {
      visitDate: this.formatDate(visitDate),
      patientName: formValue.patientName ?? '',
      procedureName: this.normalizeProcedureName(formValue.procedureName ?? 'Інше'),
      amount: Number(formValue.amount),
      percent: Number(formValue.percent),
      notes: formValue.notes ?? ''
    };
  }

  private notifyError(message: string, error: unknown): void {
    console.error(error);
    this.snackBar.open(message, 'OK', { duration: 3200 });
  }

  private resetForm(): void {
    this.editedVisitId.set(null);
    this.visitForm.reset({
      visitDate: this.getTodayDate(),
      patientName: '',
      procedureName: 'Консультація',
      amount: null,
      percent: 30,
      notes: ''
    });
  }

  private normalizeProcedureName(value: string): string {
    return this.procedureOptions.includes(value) ? value : 'Інше';
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private parseVisitDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return this.getTodayDate();
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
}
