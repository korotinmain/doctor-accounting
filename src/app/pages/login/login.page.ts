import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';

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
  ) {}

  async signInWithGoogle(): Promise<void> {
    if (this.signingIn) {
      return;
    }

    this.signingIn = true;
    this.errorMessage = null;

    try {
      await this.authSession.signInWithGoogle();
      await this.router.navigateByUrl('/');
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/popup-closed-by-user') {
        this.errorMessage = 'Вхід скасовано. Спробуйте ще раз.';
      } else {
        this.errorMessage = 'Не вдалося увійти через Google. Спробуйте знову.';
      }
    } finally {
      this.signingIn = false;
    }
  }
}
