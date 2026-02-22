import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-action-panel',
  standalone: true,
  imports: [NgIf, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './action-panel.component.html',
  styleUrls: ['./action-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionPanelComponent {
  @Input({ required: true }) selectedMonthLabel = '';
  @Input() monthLoading = false;
  @Input() totalVisits = 0;

  @Output() createVisitRequested = new EventEmitter<void>();

  openCreateDialog(): void {
    this.createVisitRequested.emit();
  }
}
