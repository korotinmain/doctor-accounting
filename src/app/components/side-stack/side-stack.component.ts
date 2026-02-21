import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { DailyInsight } from '../../utils/visits-analytics';

@Component({
  selector: 'app-side-stack',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './side-stack.component.html',
  styleUrls: ['./side-stack.component.scss']
})
export class SideStackComponent {
  @Input() monthLoading = false;
  @Input() topDays: DailyInsight[] = [];
}
