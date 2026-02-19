import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { LedgerVm } from '../../models/ledger-view.model';
import { Visit } from '../../models/visit.model';
import { VisitsSort } from '../../utils/visits-analytics';

@Component({
  selector: 'app-visits-ledger',
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
    MatTableModule
  ],
  templateUrl: './visits-ledger.component.html',
  styleUrls: ['./visits-ledger.component.scss']
})
export class VisitsLedgerComponent {
  @Input({ required: true }) ledgerVm!: LedgerVm;
  @Input() monthLoading = false;
  @Input() totalVisits = 0;
  @Input() deletingId: string | null = null;
  @Input({ required: true }) searchControl!: FormControl<string>;
  @Input({ required: true }) sortControl!: FormControl<VisitsSort>;

  @Output() createVisitRequested = new EventEmitter<void>();
  @Output() clearSearchRequested = new EventEmitter<void>();
  @Output() editVisitRequested = new EventEmitter<Visit>();
  @Output() deleteVisitRequested = new EventEmitter<Visit>();

  readonly displayedColumns = [
    'visitDate',
    'patientName',
    'procedureName',
    'amount',
    'percent',
    'doctorIncome',
    'actions'
  ];

  trackByVisitId(_: number, visit: Visit): string {
    return visit.id;
  }

  openCreateDialog(): void {
    this.createVisitRequested.emit();
  }

  clearSearch(): void {
    this.clearSearchRequested.emit();
  }

  editVisit(visit: Visit): void {
    this.editVisitRequested.emit(visit);
  }

  deleteVisit(visit: Visit): void {
    this.deleteVisitRequested.emit(visit);
  }
}
