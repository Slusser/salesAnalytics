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
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import type {
  OrderCalculationInput,
  OrderCalculationResult,
  OrderFormModel,
  OrderFormServerErrors,
} from '../../../../pages/orders/new/orders-new.types';
import { LoaderButtonComponent } from '../../loader-button/loader-button.component';

const ORDER_NO_MAX_LENGTH = 64;
const ITEM_NAME_MAX_LENGTH = 120;
const COMMENT_MAX_LENGTH = 1000;

const PERCENT_VALIDATORS = [Validators.min(0), Validators.max(100)];

type OrderFormGroup = FormGroup<{
  orderNo: FormControl<string>;
  customerId: FormControl<string>;
  orderDate: FormControl<string>;
  itemName: FormControl<string>;
  quantity: FormControl<number>;
  currencyCode: FormControl<OrderFormModel['currencyCode']>;
  eurRate: FormControl<number | null>;
  producerDiscountPct: FormControl<number>;
  distributorDiscountPct: FormControl<number>;
  vatRatePct: FormControl<number>;
  totalNetPln: FormControl<number>;
  totalGrossPln: FormControl<number>;
  totalGrossEur: FormControl<number | null>;
  comment: FormControl<string | null>;
}>;

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    NzAlertModule,
    LoaderButtonComponent,
  ],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly model = input.required<OrderFormModel>();
  readonly submitting = input(false);
  readonly serverErrors = input<OrderFormServerErrors | null>(null);
  readonly calculation = input<OrderCalculationResult | null>(null);

  readonly customersOptions = input<{ label: string; value: string }[]>([], {
    alias: 'customers',
  });

  readonly submit = output<OrderFormModel>({ alias: 'onSubmit' });
  readonly cancel = output<void>({ alias: 'onCancel' });
  readonly dirtyChange = output<boolean>({ alias: 'onDirtyChange' });
  readonly recalculate = output<OrderCalculationInput>({
    alias: 'onRecalculate',
  });

  private readonly submittingSignal = signal(this.submitting());
  private readonly serverErrorsSignal: WritableSignal<OrderFormServerErrors | null> =
    signal(this.serverErrors());
  private readonly calculationSignal = signal(this.calculation());

  protected readonly form = this.buildForm();
  protected readonly canShowEurFields = computed(
    () => this.form.controls.currencyCode.value === 'EUR'
  );
  protected readonly hasServerErrors = computed(
    () => !!this.serverErrorsSignal()
  );
  protected readonly generalError = computed(
    () => this.serverErrorsSignal()?.generalError ?? ''
  );

  protected readonly orderNoError = computed(() =>
    this.resolveErrorMessage('orderNo')
  );
  protected readonly customerError = computed(() =>
    this.resolveErrorMessage('customerId')
  );
  protected readonly orderDateError = computed(() =>
    this.resolveErrorMessage('orderDate')
  );
  protected readonly itemNameError = computed(() =>
    this.resolveErrorMessage('itemName')
  );
  protected readonly quantityError = computed(() =>
    this.resolveErrorMessage('quantity')
  );
  protected readonly currencyError = computed(() =>
    this.resolveErrorMessage('currencyCode')
  );
  protected readonly eurRateError = computed(() =>
    this.resolveErrorMessage('eurRate')
  );
  protected readonly totalNetError = computed(() =>
    this.resolveErrorMessage('totalNetPln')
  );
  protected readonly totalGrossPlnError = computed(() =>
    this.resolveErrorMessage('totalGrossPln')
  );
  protected readonly totalGrossEurError = computed(() =>
    this.resolveErrorMessage('totalGrossEur')
  );

  constructor() {
    this.setupModelEffect();
    this.setupSubmittingEffect();
    this.setupServerErrorsEffect();
    this.setupDirtyTracking();
    this.setupRecalculationEffect();
    this.enforceCurrencyControls();
  }

  protected onSubmit(): void {
    if (this.submittingSignal()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.toFormModel();
    this.submit.emit(value);
  }

  protected onCancel(): void {
    if (this.submittingSignal()) {
      return;
    }

    this.cancel.emit();
  }

  private buildForm(): OrderFormGroup {
    return this.fb.group({
      orderNo: this.fb.control('', {
        validators: [
          Validators.required,
          Validators.maxLength(ORDER_NO_MAX_LENGTH),
        ],
      }),
      customerId: this.fb.control('', { validators: [Validators.required] }),
      orderDate: this.fb.control('', { validators: [Validators.required] }),
      itemName: this.fb.control('', {
        validators: [
          Validators.required,
          Validators.maxLength(ITEM_NAME_MAX_LENGTH),
        ],
      }),
      quantity: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0.01)],
      }),
      currencyCode: this.fb.control<'PLN' | 'EUR'>('PLN', {
        validators: [Validators.required],
      }),
      eurRate: this.fb.control<number | null>(null),
      producerDiscountPct: this.fb.control(0, {
        validators: PERCENT_VALIDATORS,
      }),
      distributorDiscountPct: this.fb.control(0, {
        validators: PERCENT_VALIDATORS,
      }),
      vatRatePct: this.fb.control(23, {
        validators: [Validators.required, ...PERCENT_VALIDATORS],
      }),
      totalNetPln: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      totalGrossPln: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      totalGrossEur: this.fb.control<number | null>(null),
      comment: this.fb.control<string | null>(null, {
        validators: [Validators.maxLength(COMMENT_MAX_LENGTH)],
      }),
    });
  }

  private setupModelEffect(): void {
    effect(() => {
      const model = this.model();
      this.form.reset(
        {
          ...model,
          eurRate: model.eurRate ?? null,
          totalGrossEur: model.totalGrossEur ?? null,
          comment: model.comment ?? null,
        },
        { emitEvent: false }
      );
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.enforceCurrencyControls();
    });
  }

  private setupSubmittingEffect(): void {
    effect(() => {
      const submitting = this.submitting();
      this.submittingSignal.set(submitting);
      if (submitting) {
        this.form.disable({ emitEvent: false });
        return;
      }

      this.form.enable({ emitEvent: false });
      this.enforceCurrencyControls();
    });
  }

  private setupServerErrorsEffect(): void {
    effect(() => {
      const errors = this.serverErrors();
      this.serverErrorsSignal.set(errors);

      this.clearServerErrors();

      if (!errors) {
        return;
      }

      if (errors.fieldErrors) {
        Object.entries(errors.fieldErrors).forEach(([key, message]) => {
          const control =
            this.form.controls[key as keyof OrderFormGroup['controls']];
          if (control && message) {
            control.setErrors({ ...(control.errors ?? {}), server: message });
          }
        });
      }

      if (errors.generalError) {
        this.form.setErrors({ server: errors.generalError });
      }
    });

    this.form.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.serverErrorsSignal()) {
          return;
        }

        this.clearServerErrors();
        this.serverErrorsSignal.set(null);
      });
  }

  private setupDirtyTracking(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dirtyChange.emit(this.form.dirty);
      });
  }

  private setupRecalculationEffect(): void {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const value = this.toFormModel();
        const input: OrderCalculationInput = {
          net: value.totalNetPln,
          producerDiscountPct: value.producerDiscountPct,
          distributorDiscountPct: value.distributorDiscountPct,
          vatRatePct: value.vatRatePct,
          currency: value.currencyCode,
          eurRate: value.eurRate,
        };

        this.recalculate.emit(input);
      });
  }

  private clearServerErrors(): void {
    Object.values(this.form.controls).forEach((control) => {
      if (!control.errors) {
        return;
      }

      const { server, ...rest } = control.errors;
      control.setErrors(Object.keys(rest).length ? rest : null);
    });
    if (this.form.errors?.['server']) {
      const { server, ...rest } = this.form.errors;
      this.form.setErrors(Object.keys(rest).length ? rest : null);
    }
  }

  private enforceCurrencyControls(): void {
    const currency = this.form.controls.currencyCode.value;
    const eurRateControl = this.form.controls.eurRate;
    const grossEurControl = this.form.controls.totalGrossEur;

    if (currency === 'EUR') {
      eurRateControl.enable({ emitEvent: false });
      grossEurControl.enable({ emitEvent: false });
      return;
    }

    eurRateControl.disable({ emitEvent: false });
    eurRateControl.setValue(null, { emitEvent: false });
    grossEurControl.disable({ emitEvent: false });
    grossEurControl.setValue(null, { emitEvent: false });
  }

  private resolveErrorMessage(controlName: keyof OrderFormModel): string {
    const control =
      this.form.controls[controlName as keyof OrderFormGroup['controls']];
    if (!control) {
      return '';
    }

    if (!control.touched && !control.dirty && !control.errors?.['server']) {
      return '';
    }

    if (control.hasError('required')) {
      switch (controlName) {
        case 'orderNo':
          return 'Numer zamówienia jest wymagany.';
        case 'customerId':
          return 'Kontrahent jest wymagany.';
        case 'orderDate':
          return 'Data zamówienia jest wymagana.';
        case 'itemName':
          return 'Nazwa produktu jest wymagana.';
        case 'quantity':
          return 'Ilość jest wymagana.';
        case 'currencyCode':
          return 'Wybierz walutę.';
        case 'totalNetPln':
          return 'Kwota netto PLN jest wymagana.';
        case 'totalGrossPln':
          return 'Kwota brutto PLN jest wymagana.';
        default:
          break;
      }
    }

    if (control.hasError('maxlength')) {
      if (controlName === 'orderNo') {
        return `Numer zamówienia może mieć maksymalnie ${ORDER_NO_MAX_LENGTH} znaków.`;
      }
      if (controlName === 'itemName') {
        return `Nazwa produktu może mieć maksymalnie ${ITEM_NAME_MAX_LENGTH} znaków.`;
      }
      if (controlName === 'comment') {
        return `Komentarz może mieć maksymalnie ${COMMENT_MAX_LENGTH} znaków.`;
      }
    }

    if (control.hasError('min')) {
      if (controlName === 'quantity') {
        return 'Ilość musi być większa od zera.';
      }
      if (controlName === 'totalNetPln') {
        return 'Kwota netto PLN nie może być ujemna.';
      }
      if (controlName === 'totalGrossPln') {
        return 'Kwota brutto PLN nie może być ujemna.';
      }
    }

    if (control.hasError('max')) {
      return 'Wartość procentowa musi mieścić się w zakresie 0-100%.';
    }

    if (control.errors?.['server']) {
      return control.errors['server'];
    }

    return '';
  }

  private toFormModel(): OrderFormModel {
    const raw = this.form.getRawValue();
    return {
      orderNo: raw.orderNo.trim(),
      customerId: raw.customerId,
      orderDate: raw.orderDate,
      itemName: raw.itemName.trim(),
      quantity: Number(raw.quantity),
      currencyCode: raw.currencyCode,
      eurRate: raw.eurRate ?? undefined,
      producerDiscountPct: Number(raw.producerDiscountPct),
      distributorDiscountPct: Number(raw.distributorDiscountPct),
      vatRatePct: Number(raw.vatRatePct),
      totalNetPln: Number(raw.totalNetPln),
      totalGrossPln: Number(raw.totalGrossPln),
      totalGrossEur: raw.totalGrossEur ?? undefined,
      comment: raw.comment ?? undefined,
      isEur: raw.currencyCode === 'EUR',
    };
  }
}
