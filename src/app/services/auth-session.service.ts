import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, authState, signInWithPopup, signInWithRedirect, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { Observable, map, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly user$ = authState(this.auth).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(map((user) => Boolean(user)));

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(this.auth, provider);
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : '';

      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
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
}
