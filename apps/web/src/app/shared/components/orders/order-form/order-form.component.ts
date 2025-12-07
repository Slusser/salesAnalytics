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
import { CustomersService } from '../../../../service/customers/customers.service';
import type { CustomerDto } from '@shared/dtos/customers.dto';

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
  catalogUnitGrossPln: FormControl<number>;
  producerDiscountPct: FormControl<number>;
  distributorDiscountPct: FormControl<number>;
  vatRatePct: FormControl<number>;
  totalNetPln: FormControl<number>;
  totalGrossPln: FormControl<number>;
  distributorPricePln: FormControl<number>;
  customerPricePln: FormControl<number>;
  profitPln: FormControl<number>;
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

  private readonly customersService = inject(CustomersService);

  protected readonly customersOptions = signal<{ label: string; value: string }[]>([]);
  private readonly customersLookup = signal<Record<string, CustomerDto>>({});

  readonly submitted = output<OrderFormModel>();
  readonly cancelled = output<void>();
  readonly dirtyChange = output<boolean>();
  readonly recalculate = output<OrderCalculationInput>();

  private readonly submittingSignal = signal(this.submitting());
  private readonly serverErrorsSignal: WritableSignal<OrderFormServerErrors | null> =
    signal(this.serverErrors());
  private readonly calculationSignal = signal(this.calculation());

  protected readonly form = this.buildForm();
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
  protected readonly catalogUnitGrossError = computed(() =>
    this.resolveErrorMessage('catalogUnitGrossPln')
  );
  protected readonly totalNetError = computed(() =>
    this.resolveErrorMessage('totalNetPln')
  );
  protected readonly totalGrossPlnError = computed(() =>
    this.resolveErrorMessage('totalGrossPln')
  );
  protected readonly distributorPriceError = computed(() =>
    this.resolveErrorMessage('distributorPricePln')
  );
  protected readonly customerPriceError = computed(() =>
    this.resolveErrorMessage('customerPricePln')
  );

  constructor() {
    this.loadCustomersOptions();
    this.setupModelEffect();
    this.setupSubmittingEffect();
    this.setupServerErrorsEffect();
    this.setupDirtyTracking();
    this.setupRecalculationEffect();
    this.setupCalculationSyncEffect();
    this.setupCustomerDefaultDiscountSync();
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
    this.submitted.emit(value);
  }

  protected onCancel(): void {
    if (this.submittingSignal()) {
      return;
    }

    this.cancelled.emit();
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
      catalogUnitGrossPln: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      producerDiscountPct: this.fb.control(35, {
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
      distributorPricePln: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      customerPricePln: this.fb.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      profitPln: this.fb.control(0),
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
          comment: model.comment ?? null,
        },
        { emitEvent: false }
      );
      this.form.markAsPristine();
      this.form.markAsUntouched();
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
        if (this.form.pristine) {
          this.form.markAsDirty();
        }
        this.dirtyChange.emit(this.form.dirty);
      });
  }

  private setupRecalculationEffect(): void {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const value = this.toFormModel();
        const input: OrderCalculationInput = {
          catalogUnitGrossPln: value.catalogUnitGrossPln,
          quantity: value.quantity,
          vatRatePct: value.vatRatePct,
          producerDiscountPct: value.producerDiscountPct,
          distributorDiscountPct: value.distributorDiscountPct,
        };

        this.recalculate.emit(input);
      });
  }

  private setupCalculationSyncEffect(): void {
    effect(() => {
      const calculation = this.calculation();
      if (!calculation) {
        return;
      }

      this.form.patchValue(
        {
          totalGrossPln: calculation.totalGrossPln,
          totalNetPln: calculation.totalNetPln,
          distributorPricePln: calculation.distributorPricePln,
          customerPricePln: calculation.customerPricePln,
          profitPln: calculation.profitPln,
        },
        { emitEvent: false }
      );
    });
  }

  private clearServerErrors(): void {
    Object.values(this.form.controls).forEach((control) => {
      if (!control.errors) {
        return;
      }

      const rest = { ...control.errors };
      delete rest['server'];
      control.setErrors(Object.keys(rest).length ? rest : null);
    });
    if (this.form.errors?.['server']) {
      const rest = { ...this.form.errors };
      delete rest['server'];
      this.form.setErrors(Object.keys(rest).length ? rest : null);
    }
  }

  private loadCustomersOptions(): void {
    this.customersService
      .get({ limit: 1000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customers) => {
          const activeCustomers = customers.filter((customer) => customer.isActive);
          const options = activeCustomers
            .map((customer) => ({
              label: customer.name,
              value: customer.id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pl', { sensitivity: 'base' }));

          this.customersOptions.set(options);
          const lookup = activeCustomers.reduce<Record<string, CustomerDto>>(
            (acc, customer) => {
              acc[customer.id] = customer;
              return acc;
            },
            {},
          );
          this.customersLookup.set(lookup);
        },
        error: (error) => {
          console.error('Nie udało się pobrać listy kontrahentów.', error);
          this.customersOptions.set([]);
          this.customersLookup.set({});
        },
      });
  }

  private setupCustomerDefaultDiscountSync(): void {
    this.form.controls.customerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((customerId) => {
        if (!customerId) {
          return;
        }

        const customer = this.customersLookup()[customerId];
        if (!customer) {
          return;
        }

        const targetValue = Number(customer.defaultDistributorDiscountPct) || 0;
        const control = this.form.controls.distributorDiscountPct;
        const currentValue = Number(control.value) || 0;

        if (currentValue === targetValue) {
          return;
        }

        control.setValue(targetValue);
      });
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
        case 'catalogUnitGrossPln':
          return 'Cena katalogowa brutto jest wymagana.';
        case 'totalNetPln':
          return 'Kwota netto PLN jest wymagana.';
        case 'totalGrossPln':
          return 'Kwota brutto PLN jest wymagana.';
        case 'distributorPricePln':
          return 'Cena dystrybutora jest wymagana.';
        case 'customerPricePln':
          return 'Cena kontrahenta jest wymagana.';
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
      if (controlName === 'catalogUnitGrossPln') {
        return 'Cena katalogowa brutto nie może być ujemna.';
      }
      if (controlName === 'distributorPricePln') {
        return 'Cena dystrybutora nie może być ujemna.';
      }
      if (controlName === 'customerPricePln') {
        return 'Cena kontrahenta nie może być ujemna.';
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
      catalogUnitGrossPln: Number(raw.catalogUnitGrossPln),
      producerDiscountPct: Number(raw.producerDiscountPct),
      distributorDiscountPct: Number(raw.distributorDiscountPct),
      vatRatePct: Number(raw.vatRatePct),
      totalNetPln: Number(raw.totalNetPln),
      totalGrossPln: Number(raw.totalGrossPln),
      distributorPricePln: Number(raw.distributorPricePln),
      customerPricePln: Number(raw.customerPricePln),
      profitPln: Number(raw.profitPln),
      comment: raw.comment ?? undefined,
    };
  }
}
