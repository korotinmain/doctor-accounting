import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { NavigationEnd, Router } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsTrackingService {
  private readonly router = inject(Router);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (!this.analytics) {
      return;
    }

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((urlPath) => {
        this.trackPageView(urlPath);
      });
  }

  private trackPageView(urlPath: string): void {
    if (!this.analytics) {
      return;
    }

    logEvent(this.analytics, 'page_view', {
      page_path: urlPath,
      page_title: document.title,
      page_location: window.location.href
    });
  }
}
