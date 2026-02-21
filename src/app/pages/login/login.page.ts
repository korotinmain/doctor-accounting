import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
export class LoginPageComponent {
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

  async signInWithGoogle(): Promise<void> {
    if (this.signingIn) {
      return;
    }

    this.signingIn = true;
    this.errorMessage = null;

    try {
      await this.authSession.signInWithGoogle();
    } catch (error) {
      this.errorMessage =
        error instanceof FirebaseError ? 'Не вдалося увійти через Google. Спробуйте знову.' : 'Помилка входу.';
    } finally {
      this.signingIn = false;
    }
  }
}
