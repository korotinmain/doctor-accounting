import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-report-header',
  standalone: true,
  imports: [NgIf, MatIconModule],
  templateUrl: './report-header.component.html',
  styleUrls: ['./report-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportHeaderComponent {
  @Input() userDisplayName = '';
  @Input() userEmail = '';
  @Input() userPhotoUrl = '';

  @Output() logoutRequested = new EventEmitter<void>();

  get resolvedDisplayName(): string {
    return this.userDisplayName || this.getEmailLocalPart(this.userEmail) || 'Користувач';
  }

  get triggerDisplayName(): string {
    const source = this.resolvedDisplayName.trim();
    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      return source;
    }

    return `${tokens[0]} ${tokens[1]}`;
  }

  get userHint(): string {
    return this.userEmail || this.resolvedDisplayName;
  }

  get avatarText(): string {
    if (this.userPhotoUrl) {
      return '';
    }

    const source = this.resolvedDisplayName.trim();
    if (!source) {
      return 'К';
    }

    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return tokens[0][0]?.toUpperCase() ?? 'К';
    }

    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
  }

  logout(): void {
    this.logoutRequested.emit();
  }

  private getEmailLocalPart(email: string): string {
    const localPart = email.split('@')[0];
    return localPart || '';
  }
}
