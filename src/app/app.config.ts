import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes), // This configures the routes
    provideHttpClient(),
    importProvidersFrom(
      BrowserAnimationsModule
    ),
    provideToastr({
      timeOut: 5000,
      positionClass: 'toast-bottom-right',
      closeButton: true,
      tapToDismiss: true,
    }),
  ]
};
