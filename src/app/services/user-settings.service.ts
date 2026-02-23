import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

import { AuthSessionService } from './auth-session.service';

export type ExportFormat = 'csv' | 'excel';
export type AppTheme = 'sky-blue' | 'forest' | 'sunset' | 'royal';

const VALID_THEMES: AppTheme[] = ['sky-blue', 'forest', 'sunset', 'royal'];

/** localStorage key used ONLY as a fast read-cache for the theme on page reload.
 *  Firestore is the source of truth — this just avoids a flash of the wrong theme
 *  while Firebase auth is initialising. */
const THEME_CACHE_KEY = 'doctor-accounting:theme';

interface StoredSettings {
  percentPresets: number[];
  exportFormat: ExportFormat;
  theme: AppTheme;
}

const DEFAULTS: StoredSettings = {
  percentPresets: [10, 20, 30, 40, 50],
  exportFormat: 'csv',
  theme: 'sky-blue'
};

@Injectable({ providedIn: 'root' })
export class UserSettingsService implements OnDestroy {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly authSession = inject(AuthSessionService);

  private readonly _percentPresets = signal<number[]>(DEFAULTS.percentPresets);
  private readonly _exportFormat = signal<ExportFormat>(DEFAULTS.exportFormat);
  private readonly _theme = signal<AppTheme>(DEFAULTS.theme);

  readonly percentPresets = this._percentPresets.asReadonly();
  readonly exportFormat = this._exportFormat.asReadonly();
  readonly theme = this._theme.asReadonly();

  /** Becomes true once the initial Firestore load has completed.
   *  Using a signal so _saveEffect re-runs automatically when loading finishes. */
  private readonly _loaded = signal(false);

  private readonly _authSub: Subscription;

  private readonly _saveEffect = effect(() => {
    const data: StoredSettings = {
      percentPresets: this._percentPresets(),
      exportFormat: this._exportFormat(),
      theme: this._theme()
    };

    this.applyTheme(data.theme);

    if (!this._loaded()) return;

    // Keep the theme cache in sync so the next page reload is instant.
    try {
      localStorage.setItem(THEME_CACHE_KEY, data.theme);
    } catch {
      /* ignore */
    }

    void this.persistToFirestore(data);
  });

  constructor() {
    // Apply theme immediately from local cache (if available) so there is no
    // flash of the default colour while Firebase auth is initialising.
    const cachedTheme = this.readThemeCache();
    this.applyTheme(cachedTheme ?? DEFAULTS.theme);

    // Re-load whenever the signed-in user changes (login / logout).
    this._authSub = this.authSession.user$.subscribe((user) => {
      if (user) {
        void this.loadFromFirestore(user.uid);
      } else {
        this._loaded.set(false);
        this._percentPresets.set(DEFAULTS.percentPresets);
        this._exportFormat.set(DEFAULTS.exportFormat);
        this._theme.set(DEFAULTS.theme);
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

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private settingsDocRef(uid: string) {
    return doc(this.firestore, `users/${uid}/settings/app`);
  }

  private readThemeCache(): AppTheme | null {
    try {
      const raw = localStorage.getItem(THEME_CACHE_KEY);
      return raw && (VALID_THEMES as string[]).includes(raw) ? (raw as AppTheme) : null;
    } catch {
      return null;
    }
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

    if (stored.theme && VALID_THEMES.includes(stored.theme)) {
      this._theme.set(stored.theme);
    }

    this.applyTheme(this._theme());
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }
}
