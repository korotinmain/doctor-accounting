import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { of } from 'rxjs';

import { AppComponent } from './app.component';
import { VisitsService } from './services/visits.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: VisitsService,
          useValue: {
            getVisitsByMonth: () => of([]),
            createVisit: async () => undefined,
            updateVisit: async () => undefined,
            deleteVisit: async () => undefined
          }
        },
        {
          provide: Auth,
          useValue: {
            currentUser: { uid: 'spec-user' }
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
