import { NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnInit,
  Signal,
  ViewChild
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface VisitDialogData {
  editedVisitId: Signal<string | null>;
  saving: Signal<boolean>;
  visitForm: FormGroup;
  procedureOptions: string[];
  percentQuickOptions: number[];
  projectedIncome$: Observable<number>;
}

@Component({
  selector: 'app-visit-dialog',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './visit-dialog.component.html',
  styleUrls: ['./visit-dialog.component.scss'],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'uk-UA' }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('patientNameInput') patientNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;

  readonly maxVisitDate = new Date();

  constructor(
    public readonly dialogRef: MatDialogRef<VisitDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: VisitDialogData
  ) {}

  ngOnInit(): void {
    this.dialogRef.backdropClick().subscribe(() => this.closeDialog());
    this.dialogRef
      .keydownEvents()
      .pipe(filter((e) => e.key === 'Escape'))
      .subscribe(() => this.closeDialog());
  }

  ngAfterViewInit(): void {
    this.scheduleFocus();
  }

  closeDialog(): void {
    if (this.data.saving()) {
      return;
    }

    this.dialogRef.close();
  }

  submitForm(): void {
    this.dialogRef.close('submit');
  }

  applyQuickPercent(value: number): void {
    const percentControl = this.percentControl;

    if (!percentControl) {
      return;
    }

    percentControl.setValue(value);
    percentControl.markAsTouched();
    percentControl.markAsDirty();
  }

  applyProcedureDefaultPercent(event: MatSelectChange): void {
    const percentControl = this.percentControl;

    if (!percentControl) {
      return;
    }

    const selectedProcedure = String(event.value ?? '');
    const defaultPercent = selectedProcedure === 'Операція' ? 10 : 30;

    percentControl.setValue(defaultPercent);
    percentControl.markAsTouched();
    percentControl.markAsDirty();
  }

  isQuickPercentActive(value: number): boolean {
    return Number(this.percentControl?.value) === value;
  }

  get patientNameControl() {
    return this.data.visitForm.get('patientName');
  }

  get procedureNameControl() {
    return this.data.visitForm.get('procedureName');
  }

  get visitDateControl() {
    return this.data.visitForm.get('visitDate');
  }

  get amountControl() {
    return this.data.visitForm.get('amount');
  }

  get percentControl() {
    return this.data.visitForm.get('percent');
  }

  private scheduleFocus(): void {
    setTimeout(() => {
      const patientName = String(this.patientNameControl?.value ?? '').trim();
      const amount = this.amountControl?.value;

      if (!patientName) {
        this.patientNameInput?.nativeElement.focus();
        return;
      }

      if (amount === null || amount === undefined || amount === '') {
        this.amountInput?.nativeElement.focus();
        return;
      }

      this.patientNameInput?.nativeElement.focus();
    }, 0);
  }
}
