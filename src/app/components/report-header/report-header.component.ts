import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-report-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './report-header.component.html',
  styleUrls: ['./report-header.component.scss']
})
export class ReportHeaderComponent {
  @Input({ required: true }) selectedMonthLabel = '';

  @Output() shiftMonthRequested = new EventEmitter<number>();
  @Output() currentMonthRequested = new EventEmitter<void>();

  shiftMonth(delta: number): void {
    this.shiftMonthRequested.emit(delta);
  }

  goCurrentMonth(): void {
    this.currentMonthRequested.emit();
  }
}
