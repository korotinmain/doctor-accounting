import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AnalyticsTrackingService } from './services/analytics-tracking.service';

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
}
