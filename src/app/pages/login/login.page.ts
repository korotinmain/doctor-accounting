import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { filter } from 'rxjs';

import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPageComponent implements OnInit {
  signingIn = false;
  errorMessage: string | null = null;

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly router: Router
  ) {
    this.authSession.isAuthenticated$
      .pipe(
        filter((isAuthenticated) => isAuthenticated),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        void this.router.navigateByUrl('/');
      });
  }

  async ngOnInit(): Promise<void> {
    await this.authSession.waitForAuthReady();

    const redirectErrorCode = this.authSession.consumeRedirectErrorCode();
    if (redirectErrorCode) {
      this.errorMessage = this.resolveAuthErrorCode(redirectErrorCode);
    }

    if (this.authSession.currentUser) {
      await this.router.navigateByUrl('/');
    }
  }

  async signInWithGoogle(): Promise<void> {
    if (this.signingIn) {
      return;
    }

    this.signingIn = true;
    this.errorMessage = null;

    try {
      await this.authSession.signInWithGoogle();

      if (this.authSession.currentUser) {
        await this.router.navigateByUrl('/');
      }
    } catch (error) {
      this.errorMessage = this.resolveAuthErrorMessage(error);
    } finally {
      this.signingIn = false;
    }
  }

  private resolveAuthErrorMessage(error: unknown): string {
    return this.resolveAuthErrorCode(error instanceof FirebaseError ? error.code : null);
  }

  private resolveAuthErrorCode(code: string | null): string {
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Ви закрили вікно входу до завершення авторизації.';
      case 'auth/popup-blocked':
        return 'Браузер заблокував pop-up вікно входу. Дозвольте pop-up для цього сайту і повторіть.';
      case 'auth/unauthorized-domain':
        return 'Цей домен не дозволений у Firebase Auth (Authorized domains). Додайте поточний домен у Firebase Console.';
      case 'auth/operation-not-allowed':
        return 'Google Sign-In вимкнено у Firebase Authentication.';
      case 'auth/network-request-failed':
        return 'Помилка мережі під час входу. Перевірте інтернет і спробуйте ще раз.';
      case 'auth/redirect-no-user':
        return 'Після повернення з Google сесію не зчитано. Увімкніть cookies/storage для сайту і спробуйте ще раз.';
      case 'auth/user-token-expired':
        return 'Сесію завершено. Спробуйте увійти ще раз.';
      default:
        return code ? `Не вдалося увійти через Google (${code}).` : 'Помилка входу. Спробуйте ще раз.';
    }
  }
}
