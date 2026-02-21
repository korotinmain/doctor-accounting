import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { setUser } from '@sentry/angular';
import {
  AuthError,
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
import { Observable, map, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private static readonly pendingRedirectKey = 'auth.google.redirect.pending';

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly persistenceReady = this.ensurePersistence();
  private readonly redirectResultHandled = this.handleRedirectResult();
  private redirectErrorCode: string | null = null;

  readonly user$ = authState(this.auth).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(map((user) => Boolean(user)));

  constructor() {
    this.user$.pipe(takeUntilDestroyed()).subscribe((user) => {
      setUser(
        user
          ? {
              id: user.uid,
              email: user.email ?? undefined,
              username: user.displayName ?? undefined
            }
          : null
      );
    });
  }

  async waitForAuthReady(): Promise<void> {
    await this.persistenceReady;
    await this.redirectResultHandled;
    await this.auth.authStateReady();
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  consumeRedirectErrorCode(): string | null {
    const code = this.redirectErrorCode;
    this.redirectErrorCode = null;
    return code;
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await this.persistenceReady;

    try {
      sessionStorage.removeItem(AuthSessionService.pendingRedirectKey);
      await signInWithPopup(this.auth, provider);
      return;
    } catch (error) {
      const errorCode = (error as Partial<AuthError> | null)?.code ?? '';

      // Fallback to redirect when popup is blocked/unsupported in this runtime.
      if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/operation-not-supported-in-this-environment') {
        sessionStorage.setItem(AuthSessionService.pendingRedirectKey, '1');
        await signInWithRedirect(this.auth, provider);
        return;
      }

      throw error;
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }

  private async handleRedirectResult(): Promise<void> {
    const hadPendingRedirect = sessionStorage.getItem(AuthSessionService.pendingRedirectKey) === '1';

    try {
      const result = await getRedirectResult(this.auth);
      sessionStorage.removeItem(AuthSessionService.pendingRedirectKey);

      if (hadPendingRedirect && !result?.user && !this.auth.currentUser) {
        this.redirectErrorCode = 'auth/redirect-no-user';
      }
    } catch (error) {
      sessionStorage.removeItem(AuthSessionService.pendingRedirectKey);
      const code = (error as Partial<AuthError> | null)?.code ?? 'auth/redirect-result-failed';
      this.redirectErrorCode = code;
      console.error('Google redirect result handling failed', error);
    }
  }

  private async ensurePersistence(): Promise<void> {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
    } catch (error) {
      console.error('Failed to set auth persistence', error);
    }
  }
}
