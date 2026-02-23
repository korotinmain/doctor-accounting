import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-period-control-bar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './period-control-bar.component.html',
  styleUrls: ['./period-control-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodControlBarComponent {
  @Input({ required: true }) selectedMonthLabel = '';
  @Input() monthLoading = false;
  @Input() isCurrentMonth = false;

  @Output() shiftMonthRequested = new EventEmitter<number>();
  @Output() currentMonthRequested = new EventEmitter<void>();

  shiftMonth(delta: number): void {
    this.shiftMonthRequested.emit(delta);
  }

  goCurrentMonth(): void {
    this.currentMonthRequested.emit();
  }

  onMonthPickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.shiftMonth(-1);
      return;
    }

    if (event.key === 'ArrowRight' && !this.isCurrentMonth) {
      event.preventDefault();
      this.shiftMonth(1);
    }
  }
}
