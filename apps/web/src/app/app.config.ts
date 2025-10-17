import {
  ApplicationConfig,
  LOCALE_ID,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './service/auth/auth.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  ReloadOutline,
  SearchOutline,
  CloseOutline,
  RollbackOutline,
  EditOutline,
  DeleteOutline,
  PlusOutline
} from '@ant-design/icons-angular/icons';
import { NZ_DATE_LOCALE, pl_PL, provideNzI18n } from 'ng-zorro-antd/i18n';
import dfnsPl from 'date-fns/locale/pl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideRouter(appRoutes),
    provideNzI18n(pl_PL),
    { provide: LOCALE_ID, useValue: 'pl' },
    { provide: NZ_DATE_LOCALE, useValue: dfnsPl },
    provideNzIcons([
      ReloadOutline,
      SearchOutline,
      CloseOutline,
      RollbackOutline,
      EditOutline,
      DeleteOutline,
      PlusOutline,
    ]),
  ],
};
