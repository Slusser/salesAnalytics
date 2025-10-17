import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { NzFormModule } from 'ng-zorro-antd/form'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { AuthCardComponent } from '../../shared/components/auth/auth-card/auth-card.component'
import { AuthErrorComponent } from '../../shared/components/auth/auth-error/auth-error.component'
import { AuthSpinnerComponent } from '../../shared/components/auth/auth-spinner/auth-spinner.component'
import { NzTypographyModule } from 'ng-zorro-antd/typography'
import { take } from 'rxjs'

import { AuthApiService } from '../../service/auth/auth-api.service'
import { AuthSessionService } from '../../service/auth/auth-session.service'
import { AUTH_RETURN_URL_QUERY_PARAM } from '../../service/auth/auth.tokens'
import { toSignal } from '@angular/core/rxjs-interop'

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzTypographyModule,
    AuthCardComponent,
    AuthErrorComponent,
    AuthSpinnerComponent
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  private readonly fb = inject(FormBuilder)
  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly authApi = inject(AuthApiService)
  private readonly session = inject(AuthSessionService)

  protected readonly loading = signal(false)
  protected readonly errorMessage = signal<string | null>(null)

  protected readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.email] }),
    password: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.minLength(8)] })
  })

  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status })

  protected readonly canSubmit = computed(() => this.formStatus() === 'VALID' && !this.loading())

  protected onSubmit(): void {
    if (this.form.invalid || this.loading()) return
    this.loading.set(true)
    this.errorMessage.set(null)
    const payload = this.form.getRawValue()
    this.authApi
      .login(payload)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.session.setSession(response)
          this.loading.set(false)
          const returnUrl = this.route.snapshot.queryParamMap.get(AUTH_RETURN_URL_QUERY_PARAM) ?? '/customers'
          this.router.navigateByUrl(returnUrl)
        },
        error: (error) => {
          this.loading.set(false)
          const code = error?.error?.code ?? 'invalid_credentials'
          const message = this.mapErrorCodeToMessage(code)
          this.errorMessage.set(message)
        }
      })
  }

  private mapErrorCodeToMessage(code: string): string {
    switch (code) {
      case 'wrong_passoword':
        return 'Nieprawidłowe hasło.'
      case 'user_not_found':
        return 'Użytkownik nie istnieje.'
      case 'invalid_credentials':
      default:
        return 'Nieprawidłowy email lub hasło.'
    }
  }
}


