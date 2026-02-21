import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

registerLocaleData(localeUk);

if (environment.sentry.enabled && environment.sentry.dsn) {
  Sentry.init({
    dsn: environment.sentry.dsn,
    environment: environment.production ? 'production' : 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: environment.sentry.tracesSampleRate,
    replaysSessionSampleRate: environment.sentry.replaysSessionSampleRate,
    replaysOnErrorSampleRate: environment.sentry.replaysOnErrorSampleRate
  });
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
