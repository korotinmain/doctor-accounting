import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map, shareReplay, startWith, switchMap } from 'rxjs';

import { Visit, VisitDraft } from './models/visit.model';
import { VisitsService } from './services/visits.service';

interface DailyInsight {
  date: string;
  visits: number;
  income: number;
}

interface MonthlySummary {
  totalAmount: number;
  totalIncome: number;
  totalVisits: number;
  uniquePatients: number;
  averageCheck: number;
  averagePercent: number;
}

interface DashboardVm {
  visits: Visit[];
  summary: MonthlySummary;
  topDays: DailyInsight[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatTableModule,
    MatSnackBarModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  readonly displayedColumns = [
    'visitDate',
    'patientName',
    'procedureName',
    'amount',
    'percent',
    'doctorIncome',
    'actions'
  ];

  readonly monthControl = this.formBuilder.nonNullable.control(
    this.getCurrentMonth(),
    Validators.required
  );

  readonly visitForm = this.formBuilder.nonNullable.group({
    visitDate: [this.getToday(), Validators.required],
    patientName: ['', [Validators.required, Validators.maxLength(120)]],
    procedureName: ['Консультація', [Validators.required, Validators.maxLength(120)]],
    amount: [1150, [Validators.required, Validators.min(1)]],
    percent: [30, [Validators.required, Validators.min(0), Validators.max(100)]],
    notes: ['']
  });

  readonly projectedIncome$ = this.visitForm.valueChanges.pipe(
    startWith(this.visitForm.getRawValue()),
    map((formValue) =>
      this.calculateIncome(Number(formValue.amount), Number(formValue.percent))
    )
  );

  readonly vm$ = this.monthControl.valueChanges.pipe(
    startWith(this.monthControl.value),
    switchMap((month) => this.visitsService.getVisitsByMonth(month)),
    map((visits) => this.toViewModel(visits)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  editedVisitId: string | null = null;
  saving = false;
  deletingId: string | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly visitsService: VisitsService,
    private readonly snackBar: MatSnackBar
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
    } catch (error) {
      console.error(error);
      this.snackBar.open('Не вдалося зберегти запис', 'OK', { duration: 3200 });
    } finally {
      this.saving = false;
    }
  }

  editVisit(visit: Visit): void {
    this.editedVisitId = visit.id;

    this.visitForm.reset({
      visitDate: visit.visitDate,
      patientName: visit.patientName,
      procedureName: visit.procedureName,
      amount: visit.amount,
      percent: visit.percent,
      notes: visit.notes
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetForm();
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
      console.error(error);
      this.snackBar.open('Не вдалося видалити запис', 'OK', { duration: 3200 });
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
      visitDate: formValue.visitDate,
      patientName: formValue.patientName,
      procedureName: formValue.procedureName,
      amount: Number(formValue.amount),
      percent: Number(formValue.percent),
      notes: formValue.notes
    };
  }

  private toViewModel(visits: Visit[]): DashboardVm {
    const totalAmount = visits.reduce((sum, visit) => sum + visit.amount, 0);
    const totalIncome = visits.reduce((sum, visit) => sum + visit.doctorIncome, 0);
    const averagePercent =
      visits.length > 0
        ? visits.reduce((sum, visit) => sum + visit.percent, 0) / visits.length
        : 0;

    return {
      visits,
      summary: {
        totalAmount,
        totalIncome,
        totalVisits: visits.length,
        uniquePatients: this.getUniquePatientsCount(visits),
        averageCheck: visits.length > 0 ? totalAmount / visits.length : 0,
        averagePercent
      },
      topDays: this.getTopDays(visits)
    };
  }

  private getUniquePatientsCount(visits: Visit[]): number {
    const uniqueNames = new Set(
      visits.map((visit) => visit.patientName.trim().toLowerCase())
    );

    return uniqueNames.size;
  }

  private getTopDays(visits: Visit[]): DailyInsight[] {
    const grouped = new Map<string, DailyInsight>();

    for (const visit of visits) {
      const existing = grouped.get(visit.visitDate) ?? {
        date: visit.visitDate,
        visits: 0,
        income: 0
      };

      existing.visits += 1;
      existing.income += visit.doctorIncome;

      grouped.set(visit.visitDate, existing);
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.income - left.income)
      .slice(0, 5);
  }

  private calculateIncome(amount: number, percent: number): number {
    if (!Number.isFinite(amount) || !Number.isFinite(percent)) {
      return 0;
    }

    return Math.round((amount * percent) / 100 * 100) / 100;
  }

  private resetForm(): void {
    this.editedVisitId = null;
    this.visitForm.reset({
      visitDate: this.getToday(),
      patientName: '',
      procedureName: 'Консультація',
      amount: 1150,
      percent: 30,
      notes: ''
    });
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
