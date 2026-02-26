import { NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnInit,
  Signal,
  ViewChild,
  signal
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
  onSubmitAndAddMore?: () => Promise<void>;
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
  readonly savedFlash = signal(false);

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

  handleSubmit(): void {
    if (this.data.editedVisitId()) {
      this.submitForm();
    } else {
      this.submitAndAddMore();
    }
  }

  async submitAndAddMore(): Promise<void> {
    await this.data.onSubmitAndAddMore?.();
    this.savedFlash.set(true);
    this.playSuccessSound();
    setTimeout(() => this.savedFlash.set(false), 1800);
    this.scheduleFocus();
  }

  private playSuccessSound(): void {
    try {
      const ctx = new AudioContext();

      // Two warm marimba-like taps — Slack-inspired but distinctly ours
      // D5 → A5 (perfect fifth), quick percussive hit + short ring
      const notes = [
        { freq: 587.33, delay: 0 }, // D5 — grounding low knock
        { freq: 880.0, delay: 0.09 } // A5 — bright confirmation ding
      ];

      notes.forEach(({ freq, delay }) => {
        const t = ctx.currentTime + delay;

        // Percussive click transient at attack
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();
        click.type = 'square';
        click.frequency.value = freq * 1.6;
        click.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickGain.gain.setValueAtTime(0.06, t);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        click.start(t);
        click.stop(t + 0.03);

        // Warm fundamental tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq * 4;
        filter.Q.value = 0.5;

        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.start(t);
        osc.stop(t + 0.4);

        // Second harmonic — subtle body
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0.055, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc2.start(t);
        osc2.stop(t + 0.22);
      });
    } catch {}
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
