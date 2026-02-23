import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { filter } from 'rxjs';

import { AuthSessionService } from '../../services/auth-session.service';

type LoginMode = 'google' | 'email' | null;

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  mode: LoginMode = null;
  showPassword = false;
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

  get isBusy(): boolean {
    return this.mode !== null;
  }

  get emailInvalid(): boolean {
    const control = this.loginForm.controls.email;
    return control.invalid && (control.dirty || control.touched);
  }

  get passwordInvalid(): boolean {
    const control = this.loginForm.controls.password;
    return control.invalid && (control.dirty || control.touched);
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
    if (this.isBusy) {
      return;
    }

    this.mode = 'google';
    this.errorMessage = null;

    try {
      await this.authSession.signInWithGoogle();

      if (this.authSession.currentUser) {
        await this.router.navigateByUrl('/');
      }
    } catch (error) {
      this.errorMessage = this.resolveAuthErrorMessage(error);
      this.cdr.markForCheck();
    } finally {
      this.mode = null;
      this.cdr.markForCheck();
    }
  }

  async signInWithEmailPassword(): Promise<void> {
    if (this.isBusy) {
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.mode = 'email';
    this.errorMessage = null;

    try {
      await this.authSession.signInWithEmailPassword(email, password);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage = this.resolveAuthErrorMessage(error);
      this.cdr.markForCheck();
    } finally {
      this.mode = null;
      this.cdr.markForCheck();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
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
        return 'Цей домен не дозволений у Firebase Auth. Додайте домен у Firebase Console.';
      case 'auth/operation-not-allowed':
        return 'У Firebase вимкнено цей метод входу. Увімкніть його в Authentication -> Sign-in method.';
      case 'auth/network-request-failed':
        return 'Помилка мережі під час входу. Перевірте інтернет і спробуйте ще раз.';
      case 'auth/redirect-no-user':
        return 'Після повернення з Google сесію не зчитано. Увімкніть cookies/storage для сайту і спробуйте ще раз.';
      case 'auth/user-token-expired':
        return 'Сесію завершено. Спробуйте увійти ще раз.';
      case 'auth/invalid-email':
        return 'Невірний формат email.';
      case 'auth/user-disabled':
        return 'Цей користувач заблокований.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Невірний email або пароль.';
      case 'auth/too-many-requests':
        return 'Забагато спроб входу. Спробуйте пізніше.';
      default:
        return code ? `Не вдалося увійти (${code}).` : 'Помилка входу. Спробуйте ще раз.';
    }
  }
}
