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
        description: 'Безпечний вхід до кабінету Doctor Accounting через email/password або Google.',
        robots: 'noindex, nofollow'
      }
    },
    loadComponent: () => import('./pages/login/login.page').then((module) => module.LoginPageComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Реєстрація | Doctor Accounting',
    data: {
      seo: {
        description: 'Створіть обліковий запис Doctor Accounting для персонального кабінету та обліку прийомів.',
        robots: 'noindex, nofollow'
      }
    },
    loadComponent: () => import('./pages/register/register.page').then((module) => module.RegisterPageComponent)
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
    path: 'settings',
    canActivate: [authGuard],
    title: 'Налаштування | Doctor Accounting',
    data: {
      seo: {
        description: 'Налаштування облікового запису Doctor Accounting: теми, відсотки, формат експорту.',
        robots: 'noindex, nofollow'
      }
    },
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPageComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
