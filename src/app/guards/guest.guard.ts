import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSessionService } from '../services/auth-session.service';

export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);

  await authSession.waitForAuthReady();
  return authSession.currentUser ? router.createUrlTree(['/']) : true;
};
