import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
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
import { MatMenuModule } from '@angular/material/menu';
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
    NgClass,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatMenuModule,
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
  visibleCount = 10;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ledgerVm']) {
      this.visibleCount = this.pageSize;
    }
  }

  get pagedVisits(): Visit[] {
    return this.ledgerVm.visits.slice(0, this.visibleCount);
  }

  get shownCount(): number {
    return Math.min(this.visibleCount, this.ledgerVm.visits.length);
  }

  get hasMore(): boolean {
    return this.visibleCount < this.ledgerVm.visits.length;
  }

  loadMore(): void {
    this.visibleCount += this.pageSize;
  }

  procedureClass(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('узд') || lower.includes('ультразвук')) return 'proc--teal';
    if (lower.includes('операц') || lower.includes('хірург')) return 'proc--blue';
    if (lower.includes('консультац')) return '';
    const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return ['', 'proc--teal', 'proc--blue'][sum % 3];
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
