import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
    NzCheckboxModule,
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
  readonly readonlyState = input(false, { alias: 'readonly' });
  readonly showRestoreState = input(false, { alias: 'showRestore' });
  readonly showSoftDeleteState = input(false, { alias: 'showSoftDelete' });
  readonly showCancelState = input(true, { alias: 'showCancel' });
  readonly showActiveToggleState = input(true, { alias: 'showActiveToggle' });
  readonly showCommentState = input(true, { alias: 'showComment' });
  readonly serverErrorsState = input<ServerValidationErrors | null>(null, {
    alias: 'serverErrors',
  });

  private readonly submittingSignal: WritableSignal<boolean> = signal(
    this.submittingState()
  );
  private readonly serverErrorsSignal: WritableSignal<ServerValidationErrors | null> =
    signal(this.serverErrorsState());
  private readonly readonlySignal = signal(this.readonlyState());
  private readonly showRestoreSignal = signal(this.showRestoreState());
  private readonly showSoftDeleteSignal = signal(this.showSoftDeleteState());
  private readonly showCancelSignal = signal(this.showCancelState());
  private readonly showActiveToggleSignal = signal(
    this.showActiveToggleState()
  );
  private readonly showCommentSignal = signal(this.showCommentState());

  readonly submit = output<CustomerFormModel>({ alias: 'onSubmit' });
  readonly cancel = output<void>({ alias: 'onCancel' });
  readonly restore = output<void>({ alias: 'onRestore' });
  readonly softDelete = output<void>({ alias: 'onSoftDelete' });

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
  protected readonly isActiveError = computed(() => {
    const control = this.form.controls.isActive;
    const serverError = control.getError('server');

    if (!serverError) {
      return '';
    }

    return serverError;
  });
  protected readonly isSubmitting = computed(() => this.submittingSignal());
  protected readonly isReadonly = computed(() => this.readonlySignal());
  protected readonly customerNameMaxLength = CUSTOMER_NAME_MAX_LENGTH;
  protected readonly showRestoreButton = computed(() =>
    this.showRestoreSignal()
  );
  protected readonly showSoftDeleteButton = computed(() =>
    this.showSoftDeleteSignal()
  );
  protected readonly showCancelButton = computed(() => this.showCancelSignal());
  protected readonly showActiveToggle = computed(() =>
    this.showActiveToggleSignal()
  );
  protected readonly showCommentField = computed(() =>
    this.showCommentSignal()
  );
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
    if (this.isSubmitting() || this.isReadonly()) {
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
    if (!this.showCancelButton() || this.isSubmitting()) {
      return;
    }

    this.cancel.emit();
  }

  protected onRestore(): void {
    if (!this.showRestoreButton() || this.isSubmitting()) {
      return;
    }

    this.restore.emit();
  }

  protected onSoftDelete(): void {
    if (!this.showSoftDeleteButton() || this.isSubmitting()) {
      return;
    }

    this.softDelete.emit();
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
        this.form.controls.isActive.setErrors(null);

        if (!errors) {
          return;
        }

        if (errors.fieldErrors?.name) {
          this.form.controls.name.setErrors({
            server: errors.fieldErrors.name,
          });
        }

        if (errors.fieldErrors?.isActive) {
          this.form.controls.isActive.setErrors({
            server: errors.fieldErrors.isActive,
          });
        }

        if (errors.generalError) {
          this.form.setErrors({ server: errors.generalError });
        }
      });
  }

  private setupSubmittingState(): void {
    effect(() => {
      const disableControls = this.submittingSignal() || this.readonlySignal();
      Object.values(this.form.controls).forEach((control) => {
        if (disableControls) {
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
      this.readonlySignal.set(this.readonlyState());
      this.showRestoreSignal.set(this.showRestoreState());
      this.showSoftDeleteSignal.set(this.showSoftDeleteState());
      this.showCancelSignal.set(this.showCancelState());
      this.showActiveToggleSignal.set(this.showActiveToggleState());
      this.showCommentSignal.set(this.showCommentState());
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
          const { server, ...rest } = currentErrors;
          control.setErrors(Object.keys(rest).length ? rest : null);
        }

        const formErrors = this.form.errors ?? {};
        if (formErrors['server']) {
          const { server, ...rest } = formErrors;
          this.form.setErrors(Object.keys(rest).length ? rest : null);
        }

        this.serverErrorsSignal.set(null);
      });
    this.form.controls.isActive.valueChanges
      .pipe(
        filter(() => !!this.serverErrorsSignal()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const control = this.form.controls.isActive;
        const currentErrors = control.errors ?? {};
        if (currentErrors['server']) {
          const { server, ...rest } = currentErrors;
          control.setErrors(Object.keys(rest).length ? rest : null);
        }

        this.serverErrorsSignal.set(null);
      });
  }
}
