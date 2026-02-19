import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import { FirebaseError } from 'firebase/app';
import {
  catchError,
  combineLatest,
  defer,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs';

import { Visit, VisitDraft } from './models/visit.model';
import { VisitsService } from './services/visits.service';
import {
  VisitsSort,
  addMonths,
  buildDashboardVm,
  calculateIncome,
  filterVisits,
  sortVisits
} from './utils/visits-analytics';

interface LedgerVm {
  visits: Visit[];
  hasQuery: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatSnackBarModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild('patientNameInput') patientNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;

  readonly displayedColumns = [
    'visitDate',
    'patientName',
    'procedureName',
    'amount',
    'percent',
    'doctorIncome',
    'actions'
  ];
  readonly procedureOptions = ['Консультація', 'Операція', 'Інше'];
  readonly percentQuickOptions = [10, 20, 30, 40, 50];

  readonly monthControl = this.formBuilder.nonNullable.control(
    this.getCurrentMonth(),
    Validators.required
  );

  readonly searchControl = this.formBuilder.nonNullable.control('');
  readonly sortControl = this.formBuilder.nonNullable.control<VisitsSort>('dateDesc');

  readonly visitForm = this.formBuilder.group({
    visitDate: this.formBuilder.nonNullable.control(this.getToday(), Validators.required),
    patientName: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120)
    ]),
    procedureName: this.formBuilder.nonNullable.control('Консультація', [
      Validators.required,
      Validators.maxLength(120)
    ]),
    amount: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(1)
    ]),
    percent: this.formBuilder.nonNullable.control(30, [
      Validators.required,
      Validators.min(0),
      Validators.max(100)
    ]),
    notes: this.formBuilder.nonNullable.control('')
  });

  readonly authReady$ = defer(() => this.ensureAuthenticated()).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly projectedIncome$ = this.visitForm.valueChanges.pipe(
    startWith(this.visitForm.getRawValue()),
    map((formValue) =>
      calculateIncome(Number(formValue.amount), Number(formValue.percent))
    )
  );

  readonly monthVisits$ = combineLatest([
    this.monthControl.valueChanges.pipe(startWith(this.monthControl.value)),
    this.authReady$
  ]).pipe(
    switchMap(([month, authReady]) => {
      if (!authReady) {
        return of<Visit[]>([]);
      }

      return this.visitsService.getVisitsByMonth(month).pipe(
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
    this.monthVisits$.pipe(map(() => false))
  ).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly vm$ = this.monthVisits$.pipe(
    map((visits) => buildDashboardVm(visits)),
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
      };
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
      visitDate: visit.visitDate,
      patientName: visit.patientName,
      procedureName: this.normalizeProcedureName(visit.procedureName),
      amount: visit.amount,
      percent: visit.percent,
      notes: visit.notes
    });
    this.formDialogOpen = true;
    this.focusPreferredField();
  }

  cancelEdit(): void {
    this.formDialogOpen = false;
    this.resetForm();
  }

  openCreateDialog(): void {
    this.resetForm();
    this.formDialogOpen = true;
    this.focusPreferredField();
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

  applyQuickPercent(value: number): void {
    this.visitForm.controls.percent.setValue(value);
    this.visitForm.controls.percent.markAsTouched();
    this.visitForm.controls.percent.markAsDirty();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (!this.formDialogOpen || this.saving) {
      return;
    }

    this.closeVisitDialog();
  }

  async deleteVisit(visit: Visit): Promise<void> {
    const confirmed = window.confirm(
      `Видалити запис для ${visit.patientName} (${visit.visitDate})?`
    );

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

  trackByVisitId(_: number, visit: Visit): string {
    return visit.id;
  }

  private toDraft(): VisitDraft {
    const formValue = this.visitForm.getRawValue();

    return {
      visitDate: formValue.visitDate ?? this.getToday(),
      patientName: formValue.patientName ?? '',
      procedureName: this.normalizeProcedureName(formValue.procedureName ?? 'Інше'),
      amount: Number(formValue.amount),
      percent: Number(formValue.percent),
      notes: formValue.notes ?? ''
    };
  }

  private async ensureAuthenticated(): Promise<boolean> {
    if (this.auth.currentUser) {
      this.authErrorMessage = null;
      return true;
    }

    try {
      await signInAnonymously(this.auth);
      this.authErrorMessage = null;
      return true;
    } catch (error) {
      const code = this.getErrorCode(error);

      if (
        code === 'auth/admin-restricted-operation' ||
        code === 'auth/operation-not-allowed'
      ) {
        this.authErrorMessage =
          'Firebase Authentication не дозволяє анонімний вхід. Увімкніть Authentication -> Sign-in method -> Anonymous у Firebase Console.';
        this.snackBar.open('Увімкніть Anonymous sign-in у Firebase Console', 'OK', {
          duration: 5000
        });
        return false;
      }

      this.authErrorMessage = 'Не вдалося виконати авторизацію Firebase.';
      this.notifyError('Не вдалося виконати авторизацію', error);
      return false;
    }
  }

  private getErrorCode(error: unknown): string | null {
    if (error instanceof FirebaseError) {
      return error.code;
    }

    return null;
  }

  private notifyError(message: string, error: unknown): void {
    console.error(error);
    this.snackBar.open(message, 'OK', { duration: 3200 });
  }

  private focusPreferredField(): void {
    setTimeout(() => {
      if (!this.formDialogOpen) {
        return;
      }

      const patientName = this.visitForm.controls.patientName.value.trim();
      const amount = this.visitForm.controls.amount.value;

      if (!patientName) {
        this.patientNameInput?.nativeElement.focus();
        return;
      }

      if (amount === null) {
        this.amountInput?.nativeElement.focus();
        return;
      }

      this.patientNameInput?.nativeElement.focus();
    }, 0);
  }

  private resetForm(): void {
    this.editedVisitId = null;
    this.visitForm.reset({
      visitDate: this.getToday(),
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

  private getToday(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }
}
