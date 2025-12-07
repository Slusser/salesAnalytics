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
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
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

const PERCENTAGE_RANGE = { min: 0, max: 100 } as const;

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
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
    defaultDistributorDiscountPct: 0,
  });
  readonly submitting = input(false);
  readonly isReadonly = input(false);
  readonly showRestore = input(false);
  readonly showSoftDelete = input(false);
  readonly showCancel = input(true);
  readonly showActiveToggle = input(true);
  readonly showComment = input(true);
  readonly serverErrors = input<ServerValidationErrors | null>(null);

  private readonly submittingSignal: WritableSignal<boolean> = signal(
    this.submitting()
  );
  private readonly serverErrorsSignal: WritableSignal<ServerValidationErrors | null> =
    signal(this.serverErrors());
  private readonly readonlySignal = signal(this.isReadonly());
  private readonly showRestoreSignal = signal(this.showRestore());
  private readonly showSoftDeleteSignal = signal(this.showSoftDelete());
  private readonly showCancelSignal = signal(this.showCancel());
  private readonly showActiveToggleSignal = signal(this.showActiveToggle());
  private readonly showCommentSignal = signal(this.showComment());

  readonly submitted = output<CustomerFormModel>();
  readonly cancelled = output<void>();
  readonly restored = output<void>();
  readonly softDeleted = output<void>();

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
  protected readonly defaultDiscountError = computed(() => {
    const control = this.form.controls.defaultDistributorDiscountPct;
    const serverError = control.getError('server');
    const shouldShow = control.touched || control.dirty || !!serverError;

    if (!shouldShow) {
      return '';
    }

    if (control.hasError('min') || control.hasError('max')) {
      return 'Rabat musi mieścić się w zakresie 0-100%.';
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
  protected readonly readonlyFlag = computed(() => this.readonlySignal());
  protected readonly customerNameMaxLength = CUSTOMER_NAME_MAX_LENGTH;
  protected readonly showRestoreButton = computed(() =>
    this.showRestoreSignal()
  );
  protected readonly showSoftDeleteButton = computed(() =>
    this.showSoftDeleteSignal()
  );
  protected readonly showCancelButton = computed(() => this.showCancelSignal());
  protected readonly showActiveToggleVisible = computed(() =>
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
    defaultDistributorDiscountPct: this.fb.control(0, {
      validators: [Validators.min(PERCENTAGE_RANGE.min), Validators.max(PERCENTAGE_RANGE.max)],
    }),
  });

  constructor() {
    this.setupInitialSync();
    this.setupServerErrorsHandling();
    this.setupSubmittingState();
    this.watchInputs();
    this.setupNameControlWatcher();
  }

  protected onSubmit(): void {
    if (this.isSubmitting() || this.readonlyFlag()) {
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
      defaultDistributorDiscountPct:
        Number(this.form.controls.defaultDistributorDiscountPct.value) || 0,
    };

    this.submitted.emit(value);
  }

  protected onCancel(): void {
    if (!this.showCancelButton() || this.isSubmitting()) {
      return;
    }

    this.cancelled.emit();
  }

  protected onRestore(): void {
    if (!this.showRestoreButton() || this.isSubmitting()) {
      return;
    }

    this.restored.emit();
  }

  protected onSoftDelete(): void {
    if (!this.showSoftDeleteButton() || this.isSubmitting()) {
      return;
    }

    this.softDeleted.emit();
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
        this.form.controls.defaultDistributorDiscountPct.setErrors(null);

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

        if (errors.fieldErrors?.defaultDistributorDiscountPct) {
          this.form.controls.defaultDistributorDiscountPct.setErrors({
            server: errors.fieldErrors.defaultDistributorDiscountPct,
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
      this.submittingSignal.set(this.submitting());
      this.serverErrorsSignal.set(this.serverErrors());
      this.readonlySignal.set(this.isReadonly());
      this.showRestoreSignal.set(this.showRestore());
      this.showSoftDeleteSignal.set(this.showSoftDelete());
      this.showCancelSignal.set(this.showCancel());
      this.showActiveToggleSignal.set(this.showActiveToggle());
      this.showCommentSignal.set(this.showComment());
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
          const rest = { ...this.form.errors };
          delete rest['server'];
          control.setErrors(Object.keys(rest).length ? rest : null);
        }

        const formErrors = this.form.errors ?? {};
        if (formErrors['server']) {
          const rest = { ...this.form.errors };
          delete rest['server'];
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
          const rest = { ...this.form.errors };
          delete rest['server'];
          control.setErrors(Object.keys(rest).length ? rest : null);
        }

        this.serverErrorsSignal.set(null);
      });
    this.form.controls.defaultDistributorDiscountPct.valueChanges
      .pipe(
        filter(() => !!this.serverErrorsSignal()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const control = this.form.controls.defaultDistributorDiscountPct;
        const currentErrors = control.errors ?? {};
        if (currentErrors['server']) {
          const rest = { ...control.errors };
          delete rest['server'];
          control.setErrors(Object.keys(rest).length ? rest : null);
        }

        this.serverErrorsSignal.set(null);
      });
  }
}
