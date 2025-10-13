import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideRouter(appRoutes),
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
