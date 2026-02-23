import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

import { AuthSessionService } from './auth-session.service';

export type ExportFormat = 'csv' | 'excel';

interface StoredSettings {
  percentPresets: number[];
  exportFormat: ExportFormat;
}

const DEFAULTS: StoredSettings = {
  percentPresets: [10, 20, 30, 40, 50],
  exportFormat: 'csv'
};

@Injectable({ providedIn: 'root' })
export class UserSettingsService implements OnDestroy {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly authSession = inject(AuthSessionService);

  private readonly _percentPresets = signal<number[]>(DEFAULTS.percentPresets);
  private readonly _exportFormat = signal<ExportFormat>(DEFAULTS.exportFormat);

  readonly percentPresets = this._percentPresets.asReadonly();
  readonly exportFormat = this._exportFormat.asReadonly();

  /** Becomes true once the initial Firestore load has completed.
   *  Using a signal so _saveEffect re-runs automatically when loading finishes. */
  private readonly _loaded = signal(false);

  private readonly _authSub: Subscription;

  private readonly _saveEffect = effect(() => {
    const data: StoredSettings = {
      percentPresets: this._percentPresets(),
      exportFormat: this._exportFormat()
    };

    if (!this._loaded()) return;

    void this.persistToFirestore(data);
  });

  constructor() {
    // Re-load whenever the signed-in user changes (login / logout).
    this._authSub = this.authSession.user$.subscribe((user) => {
      if (user) {
        void this.loadFromFirestore(user.uid);
      } else {
        this._loaded.set(false);
        this._percentPresets.set(DEFAULTS.percentPresets);
        this._exportFormat.set(DEFAULTS.exportFormat);
      }
    });
  }

  ngOnDestroy(): void {
    this._saveEffect.destroy();
    this._authSub.unsubscribe();
  }

  setPercentPresets(presets: number[]): void {
    this._percentPresets.set([...presets].sort((a, b) => a - b));
  }

  setExportFormat(format: ExportFormat): void {
    this._exportFormat.set(format);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private settingsDocRef(uid: string) {
    return doc(this.firestore, `users/${uid}/settings/app`);
  }

  private async loadFromFirestore(uid: string): Promise<void> {
    this._loaded.set(false);
    try {
      const snap = await getDoc(this.settingsDocRef(uid));

      if (!snap.exists()) {
        // First login — persist defaults so the document exists.
        await setDoc(this.settingsDocRef(uid), DEFAULTS);
      } else {
        const stored = snap.data() as Partial<StoredSettings>;
        this.applyStored(stored);
      }
    } catch (err) {
      console.error('[UserSettings] loadFromFirestore failed:', err);
    } finally {
      // Setting _loaded to true re-triggers _saveEffect, which writes the
      // current signal values to Firestore even if no signal changed above.
      this._loaded.set(true);
    }
  }

  private async persistToFirestore(data: StoredSettings): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    try {
      await setDoc(this.settingsDocRef(uid), data);
    } catch (err) {
      console.error('[UserSettings] persistToFirestore failed:', err);
    }
  }

  private applyStored(stored: Partial<StoredSettings>): void {
    if (
      Array.isArray(stored.percentPresets) &&
      stored.percentPresets.length > 0 &&
      stored.percentPresets.every((n) => typeof n === 'number' && n > 0 && n <= 100)
    ) {
      this._percentPresets.set(stored.percentPresets);
    }

    if (stored.exportFormat === 'csv' || stored.exportFormat === 'excel') {
      this._exportFormat.set(stored.exportFormat);
    }
  }
}
