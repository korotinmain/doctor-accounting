export type ConfirmDialogTone = 'neutral' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  tone?: ConfirmDialogTone;
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  icon: string;
  tone: ConfirmDialogTone;
}
