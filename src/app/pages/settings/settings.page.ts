import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { ExportFormat, UserSettingsService } from '../../services/user-settings.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  private readonly settingsService = inject(UserSettingsService);

  protected presets = signal<number[]>([...this.settingsService.percentPresets()]);
  protected exportFormat = signal<ExportFormat>(this.settingsService.exportFormat());

  protected newPresetInput = '';
  protected addError = '';

  addPreset(): void {
    const val = parseFloat(this.newPresetInput.replace(',', '.'));
    if (isNaN(val) || val < 1 || val > 100) {
      this.addError = 'Введіть число від 1 до 100';
      return;
    }
    if (this.presets().includes(val)) {
      this.addError = 'Таке значення вже є';
      return;
    }
    this.addError = '';
    const updated = [...this.presets(), val];
    this.presets.set(updated);
    this.newPresetInput = '';
    this.settingsService.setPercentPresets(updated);
  }

  removePreset(pct: number): void {
    const updated = this.presets().filter((p) => p !== pct);
    this.presets.set(updated);
    this.settingsService.setPercentPresets(updated);
  }

  selectExportFormat(format: ExportFormat): void {
    this.exportFormat.set(format);
    this.settingsService.setExportFormat(format);
  }
}
