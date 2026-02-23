import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-register-page',
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
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly registerForm = this.fb.group(
    {
      fullName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: this.fb.nonNullable.control('', [Validators.required])
    },
    { validators: RegisterPageComponent.passwordsMatchValidator }
  );

  showPassword = false;
  showConfirmPassword = false;
  submitting = false;
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

  get nameInvalid(): boolean {
    const control = this.registerForm.controls.fullName;
    return control.invalid && (control.dirty || control.touched);
  }

  get emailInvalid(): boolean {
    const control = this.registerForm.controls.email;
    return control.invalid && (control.dirty || control.touched);
  }

  get passwordInvalid(): boolean {
    const control = this.registerForm.controls.password;
    return control.invalid && (control.dirty || control.touched);
  }

  get confirmPasswordInvalid(): boolean {
    const control = this.registerForm.controls.confirmPassword;
    const hasMismatch = this.registerForm.hasError('passwordMismatch');
    return (
      (control.invalid && (control.dirty || control.touched)) || (hasMismatch && (control.dirty || control.touched))
    );
  }

  async ngOnInit(): Promise<void> {
    await this.authSession.waitForAuthReady();

    if (this.authSession.currentUser) {
      await this.router.navigateByUrl('/');
    }
  }

  async registerWithEmailPassword(): Promise<void> {
    if (this.submitting) {
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { fullName, email, password } = this.registerForm.getRawValue();
    this.submitting = true;
    this.errorMessage = null;

    try {
      await this.authSession.registerWithEmailPassword(fullName ?? '', email ?? '', password ?? '');
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage = this.resolveRegisterError(error);
      this.cdr.markForCheck();
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private resolveRegisterError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : null;

    switch (code) {
      case 'auth/email-already-in-use':
        return 'Цей email вже використовується. Увійдіть або скористайтесь іншим email.';
      case 'auth/invalid-email':
        return 'Невірний формат email.';
      case 'auth/weak-password':
        return 'Слабкий пароль. Використайте щонайменше 6 символів.';
      case 'auth/operation-not-allowed':
        return 'Email/Password реєстрація вимкнена у Firebase Authentication.';
      case 'auth/network-request-failed':
        return 'Помилка мережі. Перевірте інтернет і спробуйте ще раз.';
      default:
        return code ? `Не вдалося створити акаунт (${code}).` : 'Не вдалося створити акаунт. Спробуйте ще раз.';
    }
  }

  private static passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }
}
