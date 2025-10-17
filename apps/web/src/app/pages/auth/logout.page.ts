import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { Router } from '@angular/router'

@Component({
  selector: 'app-logout-page',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutPage {
  private readonly router = inject(Router)

  constructor() {
    // Docelowo: wywołanie AuthSessionService.clearSession()
    queueMicrotask(() => this.router.navigateByUrl('/auth/login'))
  }
}

