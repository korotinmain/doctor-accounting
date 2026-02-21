import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';

interface SeoRouteData {
  description?: string;
  robots?: string;
}

const DEFAULT_TITLE = 'Doctor Accounting';
const DEFAULT_DESCRIPTION =
  'Doctor Accounting — вебзастосунок для обліку візитів, фінансів та щоденної статистики приватної медичної практики.';
const DEFAULT_ROBOTS = 'index, follow';

@Injectable({
  providedIn: 'root'
})
export class SeoMetaService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.applySeo());

    this.applySeo();
  }

  private applySeo(): void {
    const deepestSnapshot = this.getDeepestRouteSnapshot(this.router.routerState.snapshot.root);
    const routeTitle = deepestSnapshot.title;
    const seo = (deepestSnapshot.data['seo'] as SeoRouteData | undefined) ?? {};

    const resolvedTitle = typeof routeTitle === 'string' && routeTitle.length > 0 ? routeTitle : DEFAULT_TITLE;
    const resolvedDescription = seo.description?.trim() || DEFAULT_DESCRIPTION;
    const resolvedRobots = seo.robots?.trim() || DEFAULT_ROBOTS;
    const canonicalUrl = this.getCanonicalUrl();
    const ogImageUrl = this.getAbsoluteUrl('/assets/branding/logo-lockup.svg');

    this.title.setTitle(resolvedTitle);
    this.meta.updateTag({ name: 'description', content: resolvedDescription });
    this.meta.updateTag({ name: 'robots', content: resolvedRobots });
    this.meta.updateTag({ property: 'og:title', content: resolvedTitle });
    this.meta.updateTag({ property: 'og:description', content: resolvedDescription });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: ogImageUrl });
    this.meta.updateTag({ name: 'twitter:title', content: resolvedTitle });
    this.meta.updateTag({ name: 'twitter:description', content: resolvedDescription });
    this.meta.updateTag({ name: 'twitter:image', content: ogImageUrl });
    this.upsertCanonicalLink(canonicalUrl);
  }

  private getDeepestRouteSnapshot(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }

    return current;
  }

  private getCanonicalUrl(): string {
    const location = this.document.location;
    if (!location) {
      return '/';
    }

    const path = this.router.url || '/';
    return `${location.origin}${path}`;
  }

  private getAbsoluteUrl(path: string): string {
    const location = this.document.location;
    if (!location) {
      return path;
    }

    return `${location.origin}${path}`;
  }

  private upsertCanonicalLink(href: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let link = head.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }

    link.setAttribute('href', href);
  }
}
