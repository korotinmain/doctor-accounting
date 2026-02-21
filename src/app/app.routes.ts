import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Вхід | Doctor Accounting',
    data: {
      seo: {
        description: 'Безпечний вхід до кабінету Doctor Accounting через Google Authentication.',
        robots: 'noindex, nofollow'
      }
    },
    loadComponent: () => import('./pages/login/login.page').then((module) => module.LoginPageComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    title: 'Облік прийомів | Doctor Accounting',
    data: {
      seo: {
        description: 'Керуйте візитами, доходом лікаря та статистикою по днях у єдиному дашборді.',
        robots: 'index, follow'
      }
    },
    loadComponent: () => import('./pages/dashboard/dashboard.page').then((module) => module.DashboardPageComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
