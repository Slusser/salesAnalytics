import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';

@Component({
  selector: 'app-reset-confirm-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzAlertModule,
  ],
  templateUrl: './reset-confirm.page.html',
  styleUrl: './reset-confirm.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetConfirmPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
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
    this.infoMessage.set(null);
    // MVP: reset poza zakresem – komunikat informacyjny dla użytkownika
    setTimeout(() => {
      this.loading.set(false);
      this.infoMessage.set(
        'Reset haseł poza zakresem MVP. Skontaktuj się z administratorem.'
      );
    }, 600);
  }
}
