import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth, GoogleAuthProvider, authState, signInWithRedirect, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { setUser } from '@sentry/angular';
import { Observable, map, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

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

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithRedirect(this.auth, provider);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }
}
