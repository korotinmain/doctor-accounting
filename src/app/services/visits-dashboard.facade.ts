import { Injectable } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Auth, authState } from '@angular/fire/auth';
import { catchError, combineLatest, map, merge, of, shareReplay, startWith, switchMap } from 'rxjs';

import { LedgerVm } from '../models/ledger-view.model';
import { Visit, VisitDraft } from '../models/visit.model';
import {
  VisitsSort,
  addMonths,
  buildDashboardVm,
  calculateIncome,
  filterVisits,
  sortVisits
} from '../utils/visits-analytics';
import { VisitsService } from './visits.service';

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
        this.authErrorMessage = 'Увійдіть через Google, щоб працювати з журналом.';
        return of<Visit[]>([]);
      }

      this.authErrorMessage = null;

      return this.visitsService.getVisitsByMonth(month, user.uid).pipe(
        catchError((error) => {
          this.notifyError('Не вдалося завантажити записи за місяць', error);
          return of<Visit[]>([]);
        })
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
    this.monthControl.valueChanges.pipe(startWith(this.monthControl.value))
  ]).pipe(
    map(([visits, month]) => buildDashboardVm(visits, month)),
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

  editedVisitId: string | null = null;
  saving = false;
  deletingId: string | null = null;
  formDialogOpen = false;
  authErrorMessage: string | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly visitsService: VisitsService,
    private readonly snackBar: MatSnackBar,
    private readonly auth: Auth
  ) {}

  get selectedMonthLabel(): string {
    const month = this.monthControl.value;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return '';
    }

    const [year, monthNumber] = month.split('-').map(Number);

    return new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, monthNumber - 1, 1));
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
    this.saving = true;

    try {
      if (this.editedVisitId) {
        await this.visitsService.updateVisit(this.editedVisitId, draft);
        this.snackBar.open('Запис оновлено', 'OK', { duration: 2400 });
      } else {
        await this.visitsService.createVisit(draft);
        this.snackBar.open('Запис додано', 'OK', { duration: 2400 });
      }

      this.resetForm();
      this.formDialogOpen = false;
    } catch (error) {
      this.notifyError('Не вдалося зберегти запис', error);
    } finally {
      this.saving = false;
    }
  }

  editVisit(visit: Visit): void {
    this.editedVisitId = visit.id;

    this.visitForm.reset({
      visitDate: this.parseVisitDate(visit.visitDate),
      patientName: visit.patientName,
      procedureName: this.normalizeProcedureName(visit.procedureName),
      amount: visit.amount,
      percent: visit.percent,
      notes: visit.notes
    });
    this.formDialogOpen = true;
  }

  cancelEdit(): void {
    this.formDialogOpen = false;
    this.resetForm();
  }

  openCreateDialog(): void {
    this.resetForm();
    this.formDialogOpen = true;
  }

  closeVisitDialog(): void {
    if (this.saving) {
      return;
    }

    this.cancelEdit();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  async deleteVisit(visit: Visit): Promise<void> {
    const confirmed = window.confirm(`Видалити запис для ${visit.patientName} (${visit.visitDate})?`);

    if (!confirmed) {
      return;
    }

    this.deletingId = visit.id;

    try {
      await this.visitsService.deleteVisit(visit.id);
      this.snackBar.open('Запис видалено', 'OK', { duration: 2400 });

      if (this.editedVisitId === visit.id) {
        this.resetForm();
      }
    } catch (error) {
      this.notifyError('Не вдалося видалити запис', error);
    } finally {
      this.deletingId = null;
    }
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
    this.editedVisitId = null;
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
