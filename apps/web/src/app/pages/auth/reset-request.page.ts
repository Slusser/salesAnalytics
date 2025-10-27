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
  selector: 'app-reset-request-page',
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
  templateUrl: './reset-request.page.html',
  styleUrl: './reset-request.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetRequestPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly canSubmit = computed(
    () => this.form.valid && !this.loading()
  );

  protected onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.infoMessage.set(null);
    // MVP: reset poza zakresem – komunikat informacyjny dla użytkownika
    setTimeout(() => {
      this.loading.set(false);
      this.infoMessage.set(
        'Reset haseł poza zakresem MVP. Skontaktuj się z administratorem.'
      );
    }, 500);
  }
}
