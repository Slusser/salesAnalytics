import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';

import type {
  CustomerFormModel,
  ServerValidationErrors,
} from './customer-form.types';
import { LoaderButtonComponent } from '../../loader-button/loader-button.component';

const CUSTOMER_NAME_MAX_LENGTH = 120;

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSwitchModule,
    NzAlertModule,
    NzButtonModule,
    NzGridModule,
    LoaderButtonComponent,
  ],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly initialValue = input<CustomerFormModel>({
    name: '',
    isActive: true,
    comment: '',
  });
  readonly submittingState = input(false, { alias: 'submitting' });
  readonly serverErrorsState = input<ServerValidationErrors | null>(null, {
    alias: 'serverErrors',
  });

  private readonly submittingSignal: WritableSignal<boolean> = signal(
    this.submittingState()
  );
  private readonly serverErrorsSignal: WritableSignal<ServerValidationErrors | null> =
    signal(this.serverErrorsState());

  readonly submit = output<CustomerFormModel>({ alias: 'onSubmit' });
  readonly cancel = output<void>({ alias: 'onCancel' });

  protected readonly generalError = computed(
    () => this.serverErrorsSignal()?.generalError ?? ''
  );
  protected readonly nameError = computed(() => {
    const control = this.form.controls.name;
    const serverError = control.getError('server');
    const shouldShow = control.touched || !!serverError;

    if (!shouldShow) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Nazwa kontrahenta jest wymagana.';
    }

    if (control.hasError('maxlength')) {
      return `Nazwa kontrahenta może mieć maksymalnie ${CUSTOMER_NAME_MAX_LENGTH} znaków.`;
    }

    if (serverError) {
      return serverError;
    }

    return '';
  });
  protected readonly isSubmitting = computed(() => this.submittingSignal());
  protected readonly customerNameMaxLength = CUSTOMER_NAME_MAX_LENGTH;
  protected readonly form = this.fb.group({
    name: this.fb.control('', {
      validators: [
        Validators.required,
        Validators.maxLength(CUSTOMER_NAME_MAX_LENGTH),
      ],
    }),
    isActive: this.fb.control(true),
    comment: this.fb.control(''),
  });

  constructor() {
    this.setupInitialSync();
    this.setupServerErrorsHandling();
    this.setupSubmittingState();
    this.watchInputs();
    this.setupNameControlWatcher();
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const trimmedName = this.form.controls.name.value.trim();
    this.form.controls.name.setValue(trimmedName);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value: CustomerFormModel = {
      name: this.form.controls.name.value,
      isActive: this.form.controls.isActive.value,
      comment: this.form.controls.comment.value,
    };

    this.submit.emit(value);
  }

  protected onCancel(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.cancel.emit();
  }

  private setupInitialSync(): void {
    effect(
      () => {
        const value = this.initialValue();
        this.form.reset(value, { emitEvent: false });
        this.form.markAsPristine();
        this.form.markAsUntouched();
      },
      { allowSignalWrites: true }
    );
  }

  private setupServerErrorsHandling(): void {
    toObservable(this.serverErrorsSignal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((errors) => {
        this.form.setErrors(null);
        this.form.controls.name.setErrors(null);

        if (!errors) {
          return;
        }

        if (errors.fieldErrors?.name) {
          this.form.controls.name.setErrors({
            server: errors.fieldErrors.name,
          });
        }

        if (errors.generalError) {
          this.form.setErrors({ server: errors.generalError });
        }
      });
  }

  private setupSubmittingState(): void {
    effect(() => {
      const isSubmitting = this.submittingSignal();
      Object.values(this.form.controls).forEach((control) => {
        if (isSubmitting) {
          control.disable({ emitEvent: false });
          return;
        }
        control.enable({ emitEvent: false });
      });
    });
  }

  private watchInputs(): void {
    effect(() => {
      this.submittingSignal.set(this.submittingState());
      this.serverErrorsSignal.set(this.serverErrorsState());
    });
  }

  private setupNameControlWatcher(): void {
    this.form.controls.name.valueChanges
      .pipe(
        filter(() => !!this.serverErrorsSignal()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const control = this.form.controls.name;
        const currentErrors = control.errors ?? {};
        if (currentErrors['server']) {
          const { server, ...rest } = currentErrors
          control.setErrors(Object.keys(rest).length ? rest : null)
        }

        const formErrors = this.form.errors ?? {}
        if (formErrors['server']) {
          const { server, ...rest } = formErrors
          this.form.setErrors(Object.keys(rest).length ? rest : null)
        }

        this.serverErrorsSignal.set(null)
      });
  }
}
