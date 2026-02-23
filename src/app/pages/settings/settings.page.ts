import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AppTheme, ExportFormat, UserSettingsService } from '../../services/user-settings.service';

interface ThemeOption {
  id: AppTheme;
  label: string;
  swatch1: string;
  swatch2: string;
  swatch3: string;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  private readonly settingsService = inject(UserSettingsService);

  protected presets = signal<number[]>([...this.settingsService.percentPresets()]);
  protected exportFormat = signal<ExportFormat>(this.settingsService.exportFormat());
  protected theme = signal<AppTheme>(this.settingsService.theme());

  protected newPresetInput = '';
  protected addError = '';

  readonly themes: ThemeOption[] = [
    { id: 'sky-blue', label: 'Кобальт', swatch1: '#0a1533', swatch2: '#3b67d6', swatch3: '#6489e8' },
    { id: 'forest', label: 'Ліс', swatch1: '#052e16', swatch2: '#15803d', swatch3: '#4ade80' },
    { id: 'sunset', label: 'Захід', swatch1: '#431407', swatch2: '#d9500a', swatch3: '#fb923c' },
    { id: 'royal', label: 'Роял', swatch1: '#1e0a40', swatch2: '#7c3aed', swatch3: '#a78bfa' }
  ];

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

  selectTheme(themeId: AppTheme): void {
    this.theme.set(themeId);
    this.settingsService.setTheme(themeId);
  }
}
