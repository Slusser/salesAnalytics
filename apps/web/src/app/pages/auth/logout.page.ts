import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthSessionService } from '../../service/auth/auth-session.service';

@Component({
  selector: 'app-logout-page',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutPage {
  private readonly session = inject(AuthSessionService);

  constructor() {
    queueMicrotask(() => this.session.logout());
  }
}
