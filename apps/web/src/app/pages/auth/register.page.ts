import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTypographyModule } from 'ng-zorro-antd/typography';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzTypographyModule,
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.email],
    }),
    password: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmPassword: this.fb.nonNullable.control('', {
      validators: [Validators.required],
    }),
  });

  protected readonly passwordsMatch = computed(
    () =>
      this.form.controls.password.value ===
      this.form.controls.confirmPassword.value
  );
  protected readonly canSubmit = computed(
    () => this.form.valid && this.passwordsMatch() && !this.loading()
  );

  protected onSubmit(): void {
    if (this.form.invalid || !this.passwordsMatch() || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    // Backend będzie dodany później; tu tylko UX i walidacje
    setTimeout(() => {
      this.loading.set(false);
      this.successMessage.set('Użytkownik utworzony. Możesz się zalogować.');
    }, 700);
  }
}
