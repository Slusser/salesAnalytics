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

  protected readonly loading = signal(false)
  protected readonly errorMessage = signal<string | null>(null)

  protected readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.email] }),
    password: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.minLength(8)] })
  })

  protected readonly canSubmit = computed(() => this.form.valid && !this.loading())

  protected onSubmit(): void {
    if (this.form.invalid || this.loading()) return
    this.loading.set(true)
    this.errorMessage.set(null)
    // Backend zostanie podłączony później – tu symulujemy sukces/porazkę
    setTimeout(() => {
      this.loading.set(false)
      // TODO: implementacja logiki logowania po stronie serwisu AuthApiService
      const { email } = this.form.getRawValue()
      if (!email.includes('@')) {
        this.errorMessage.set('Nieprawidłowy email lub hasło.')
        return
      }
      // Docelowo: po sukcesie przekierowanie na returnUrl lub /customers
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/customers'
      this.router.navigateByUrl(returnUrl)
    }, 500)
  }
}


