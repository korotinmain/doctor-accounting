import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData, ConfirmDialogOptions } from '../models/confirm-dialog.model';

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const dialogData: ConfirmDialogData = {
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Підтвердити',
      cancelText: options.cancelText ?? 'Скасувати',
      icon: options.icon ?? (options.tone === 'danger' ? 'warning_amber' : 'help_outline'),
      tone: options.tone ?? 'neutral'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      panelClass: 'confirm-dialog-panel',
      backdropClass: 'confirm-dialog-backdrop',
      width: 'min(92vw, 420px)',
      maxWidth: '420px',
      autoFocus: false,
      restoreFocus: true
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
  }
}
