import { CurrencyPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { LedgerVm } from '../../models/ledger-view.model';
import { Visit } from '../../models/visit.model';
import { VisitsSort } from '../../utils/visits-analytics';

@Component({
  selector: 'app-visits-ledger',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule
  ],
  templateUrl: './visits-ledger.component.html',
  styleUrls: ['./visits-ledger.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitsLedgerComponent implements OnChanges {
  @Input({ required: true }) ledgerVm!: LedgerVm;
  @Input() monthLoading = false;
  @Input() totalVisits = 0;
  @Input() selectedMonthLabel = '';
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

  readonly pageSize = 10;
  currentPage = 1;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ledgerVm']) {
      this.currentPage = 1;
    }
  }

  get pagedVisits(): Visit[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.ledgerVm.visits.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.ledgerVm.visits.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (current > 3) pages.push(-1); // ellipsis
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
    return pages;
  }

  goToPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
  }

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
