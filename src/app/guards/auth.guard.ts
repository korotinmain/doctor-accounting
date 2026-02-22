import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSessionService } from '../services/auth-session.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);

  await authSession.waitForAuthReady();
  return authSession.currentUser ? true : router.createUrlTree(['/login']);
};
