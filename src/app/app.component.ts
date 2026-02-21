import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AnalyticsTrackingService } from './services/analytics-tracking.service';
import { SeoMetaService } from './services/seo-meta.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // Inject to initialize router-based page_view tracking on app startup.
  private readonly analyticsTracking = inject(AnalyticsTrackingService);
  // Inject to apply dynamic title/meta tags for SEO.
  private readonly seoMeta = inject(SeoMetaService);
}
