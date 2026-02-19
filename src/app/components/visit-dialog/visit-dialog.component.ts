import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-visit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './visit-dialog.component.html',
  styleUrls: ['./visit-dialog.component.scss'],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'uk-UA' }]
})
export class VisitDialogComponent implements OnChanges, AfterViewInit {
  @ViewChild('patientNameInput') patientNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;

  @Input() open = false;
  @Input() saving = false;
  @Input() editedVisitId: string | null = null;
  @Input() projectedIncome = 0;
  @Input() procedureOptions: string[] = [];
  @Input() percentQuickOptions: number[] = [];
  @Input({ required: true }) visitForm!: FormGroup;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() submitRequested = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.scheduleFocus();
    }
  }

  ngAfterViewInit(): void {
    if (this.open) {
      this.scheduleFocus();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (!this.open || this.saving) {
      return;
    }

    this.closeRequested.emit();
  }

  closeDialog(): void {
    if (this.saving) {
      return;
    }

    this.closeRequested.emit();
  }

  submitForm(): void {
    this.submitRequested.emit();
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
    return this.visitForm.get('patientName');
  }

  get procedureNameControl() {
    return this.visitForm.get('procedureName');
  }

  get visitDateControl() {
    return this.visitForm.get('visitDate');
  }

  get amountControl() {
    return this.visitForm.get('amount');
  }

  get percentControl() {
    return this.visitForm.get('percent');
  }

  private scheduleFocus(): void {
    setTimeout(() => {
      if (!this.open) {
        return;
      }

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
