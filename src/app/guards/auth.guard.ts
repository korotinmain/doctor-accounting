import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';

import { AuthSessionService } from '../services/auth-session.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);

  await authSession.waitForAuthReady();
  const isAuthenticated = await firstValueFrom(authSession.isAuthenticated$.pipe(take(1)));

  return isAuthenticated ? true : router.createUrlTree(['/login']);
};
