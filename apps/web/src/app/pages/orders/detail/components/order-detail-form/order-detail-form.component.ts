import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDividerModule } from 'ng-zorro-antd/divider';

import { CustomersService } from '../../../../../service/customers/customers.service';
import { OrderDetailStore } from '../../../../../service/orders/order-detail.store';
import { createInitialActionsState } from '../../../../../service/orders/order-detail.mappers';
import { computeOrderTotals } from '../../../../../shared/utils/order-calculation.util';
import type {
  OrderActionsStateVm,
  OrderDetailVm,
  OrderFormControls,
  OrderFormValidationVm,
  OrderFormValue,
} from '../../../../../service/orders/order-detail.types';
import { OrderActionsPanelComponent } from '../order-actions-panel/order-actions-panel.component';
import type { OrderCalculationInput } from '../../../new/orders-new.types';

type OrderDetailFormGroup = FormGroup<OrderFormControls>;

interface CustomerOption {
  value: string;
  label: string;
}

const COMMENT_MAX_LENGTH = 1000;
const ORDER_NO_MAX_LENGTH = 64;
const ITEM_NAME_MAX_LENGTH = 120;

@Component({
  selector: 'app-order-detail-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzSwitchModule,
    NzAlertModule,
    NzTagModule,
    NzDividerModule,
    OrderActionsPanelComponent,
  ],
  templateUrl: './order-detail-form.component.html',
  styleUrl: './order-detail-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(OrderDetailStore);
  private readonly customersService = inject(CustomersService);

  readonly detail = input.required<OrderDetailVm>();

  protected readonly customersOptions: WritableSignal<CustomerOption[]> =
    signal([]);
  protected readonly form: OrderDetailFormGroup = this.buildForm();

  protected readonly formState = this.store.formState;
  protected readonly permissions = this.store.permissions;
  protected readonly actionsState = computed<OrderActionsStateVm>(() => {
    return this.store.orderDetail()?.actions ?? createInitialActionsState();
  });
  protected readonly validationState = computed<OrderFormValidationVm>(
    () => this.formState().validation
  );

  constructor() {
    this.store.registerForm(this.form);
    this.loadCustomerOptions();
    this.setupFormSyncEffect();
    this.setupValueListener();
  }

  protected onSubmit(): void {
    const actions = this.actionsState();
    if (!actions.canSubmit || actions.submitting) {
      return;
    }

    this.store.submit();
  }

  protected onReset(): void {
    const actions = this.actionsState();
    if (!actions.canReset) {
      return;
    }

    this.store.resetForm();
  }

  protected onSoftDelete(): void {
    const actions = this.actionsState();
    if (actions.disableDelete) {
      return;
    }

    this.store.openDeleteDialog();
  }

  protected onRestore(): void {
    const actions = this.actionsState();
    if (actions.disableRestore) {
      return;
    }

    this.store.openRestoreDialog();
  }

  protected resolveError(controlName: keyof OrderFormControls): string {
    const control = this.form.controls[controlName];
    if (!control) {
      return '';
    }

    if (!control.invalid) {
      return '';
    }

    if (!control.touched && !control.dirty && !control.errors?.['server']) {
      return '';
    }

    const errors = control.errors ?? {};

    if (errors['required']) {
      switch (controlName) {
        case 'orderNo':
          return 'Numer zamówienia jest wymagany.';
        case 'customerId':
          return 'Wybierz kontrahenta.';
        case 'orderDate':
          return 'Data zamówienia jest wymagana.';
        case 'itemName':
          return 'Nazwa produktu jest wymagana.';
        case 'quantity':
          return 'Ilość jest wymagana.';
        case 'catalogUnitGrossPln':
          return 'Cena katalogowa brutto jest wymagana.';
        case 'vatRatePct':
          return 'Stawka VAT jest wymagana.';
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

    if (errors['maxlength']) {
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

    if (errors['min']) {
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

    if (errors['max']) {
      return 'Wartość procentowa musi mieścić się w zakresie 0-100%.';
    }

    if (errors['server']) {
      return errors['server'];
    }

    return '';
  }

  private buildForm(): OrderDetailFormGroup {
    return this.fb.group<OrderFormControls>({
      orderNo: this.fb.control('', {
        validators: [
          Validators.required,
          Validators.maxLength(ORDER_NO_MAX_LENGTH),
        ],
      }),
      customerId: this.fb.control('', {
        validators: [Validators.required],
      }),
      orderDate: this.fb.control('', {
        validators: [Validators.required],
      }),
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
      producerDiscountPct: this.fb.control(0, {
        validators: [Validators.min(0), Validators.max(100)],
      }),
      distributorDiscountPct: this.fb.control(0, {
        validators: [Validators.min(0), Validators.max(100)],
      }),
      vatRatePct: this.fb.control(0, {
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(100),
        ],
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

  private setupFormSyncEffect(): void {
    effect(() => {
      const state = this.formState();
      this.syncFormValue(state.value);
      this.syncDisabledState(state.disabled);

      if (!state.dirty && this.form.dirty) {
        this.form.markAsPristine();
        this.form.markAsUntouched();
      }
    });
  }

  private setupValueListener(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recalculateDerivedFieldsFromForm();
        const value = this.toOrderFormValue();

        this.store.updateFormValue(value, { markDirty: this.form.dirty });
        this.store.markFormDirty(this.form.dirty);

        const validation = this.computeValidation(value);
        const formErrors = this.collectErrors(validation);
        this.store.setFormValidity(this.form.valid, formErrors, validation);
      });
  }

  private syncFormValue(value: OrderFormValue): void {
    const current = this.toOrderFormValue();
    if (this.areValuesEqual(current, value)) {
      return;
    }

    this.form.setValue(
      {
        orderNo: value.orderNo ?? '',
        customerId: value.customerId ?? '',
        orderDate: value.orderDate ?? '',
        itemName: value.itemName ?? '',
        quantity: value.quantity ?? 0,
        catalogUnitGrossPln: value.catalogUnitGrossPln ?? 0,
        producerDiscountPct: value.producerDiscountPct ?? 0,
        distributorDiscountPct: value.distributorDiscountPct ?? 0,
        vatRatePct: value.vatRatePct ?? 0,
        totalNetPln: value.totalNetPln ?? 0,
        totalGrossPln: value.totalGrossPln ?? 0,
        distributorPricePln: value.distributorPricePln ?? 0,
        customerPricePln: value.customerPricePln ?? 0,
        profitPln: value.profitPln ?? 0,
        comment: value.comment ?? null,
      },
      { emitEvent: false }
    );

    this.recalculateDerivedFieldsFromForm();
  }

  private syncDisabledState(disabled: boolean): void {
    if (disabled) {
      if (!this.form.disabled) {
        this.form.disable({ emitEvent: false });
      }
      return;
    }

    if (this.form.disabled) {
      this.form.enable({ emitEvent: false });
    }
  }

  private toOrderFormValue(): OrderFormValue {
    const raw = this.form.getRawValue();
    return {
      orderNo: raw.orderNo.trim(),
      customerId: raw.customerId,
      orderDate: this.normalizeDate(raw.orderDate),
      itemName: raw.itemName.trim(),
      quantity: Number(raw.quantity) || 0,
      catalogUnitGrossPln: Number(raw.catalogUnitGrossPln) || 0,
      producerDiscountPct: Number(raw.producerDiscountPct) || 0,
      distributorDiscountPct: Number(raw.distributorDiscountPct) || 0,
      vatRatePct: Number(raw.vatRatePct) || 0,
      totalNetPln: Number(raw.totalNetPln) || 0,
      totalGrossPln: Number(raw.totalGrossPln) || 0,
      distributorPricePln: Number(raw.distributorPricePln) || 0,
      customerPricePln: Number(raw.customerPricePln) || 0,
      profitPln: Number(raw.profitPln) || 0,
      comment: raw.comment?.trim() ? raw.comment.trim() : null,
    };
  }

  private areValuesEqual(a: OrderFormValue, b: OrderFormValue): boolean {
    return (
      a.orderNo === b.orderNo &&
      a.customerId === b.customerId &&
      a.orderDate === b.orderDate &&
      a.itemName === b.itemName &&
      Number(a.quantity) === Number(b.quantity) &&
      Number(a.catalogUnitGrossPln) === Number(b.catalogUnitGrossPln) &&
      Number(a.producerDiscountPct) === Number(b.producerDiscountPct) &&
      Number(a.distributorDiscountPct) === Number(b.distributorDiscountPct) &&
      Number(a.vatRatePct) === Number(b.vatRatePct) &&
      Number(a.totalNetPln) === Number(b.totalNetPln) &&
      Number(a.totalGrossPln) === Number(b.totalGrossPln) &&
      Number(a.distributorPricePln) === Number(b.distributorPricePln) &&
      Number(a.customerPricePln) === Number(b.customerPricePln) &&
      Number(a.profitPln) === Number(b.profitPln) &&
      (a.comment ?? '') === (b.comment ?? '')
    );
  }

  private normalizeDate(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (
      typeof (value as unknown as { format?: unknown }).format === 'function'
    ) {
      try {
        return (
          value as unknown as { format: (pattern: string) => string }
        ).format('YYYY-MM-DD');
      } catch {
        return '';
      }
    }

    return '';
  }

  private recalculateDerivedFieldsFromForm(): void {
    const controls = this.form.controls;
    const input: OrderCalculationInput = {
      catalogUnitGrossPln: Number(controls.catalogUnitGrossPln.value) || 0,
      quantity: Number(controls.quantity.value) || 0,
      vatRatePct: Number(controls.vatRatePct.value) || 0,
      producerDiscountPct: Number(controls.producerDiscountPct.value) || 0,
      distributorDiscountPct: Number(controls.distributorDiscountPct.value) || 0,
    };
    const result = computeOrderTotals(input);
    const current = this.form.getRawValue();

    if (
      Number(current.totalGrossPln) === result.totalGrossPln &&
      Number(current.totalNetPln) === result.totalNetPln &&
      Number(current.distributorPricePln) === result.distributorPricePln &&
      Number(current.customerPricePln) === result.customerPricePln &&
      Number(current.profitPln) === result.profitPln
    ) {
      return;
    }

    this.form.patchValue(
      {
        totalGrossPln: result.totalGrossPln,
        totalNetPln: result.totalNetPln,
        distributorPricePln: result.distributorPricePln,
        customerPricePln: result.customerPricePln,
        profitPln: result.profitPln,
      },
      { emitEvent: false }
    );
  }

  private computeValidation(value: OrderFormValue): OrderFormValidationVm {
    return {
      toleranceExceeded: false,
      invalidCustomer: !value.customerId,
    };
  }

  private collectErrors(validation: OrderFormValidationVm): string[] {
    const messages = new Set<string>();

    if (!this.form.valid) {
      messages.add('Formularz zawiera błędy.');
    }

    if (validation.invalidCustomer) {
      messages.add('Wybierz poprawnego kontrahenta.');
    }

    return Array.from(messages);
  }

  private loadCustomerOptions(): void {
    this.customersService
      .get({ limit: 1000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customers) => {
          const options = customers
            .filter((customer) => customer.isActive)
            .map<CustomerOption>((customer) => ({
              label: customer.name,
              value: customer.id,
            }))
            .sort((a, b) =>
              a.label.localeCompare(b.label, 'pl', { sensitivity: 'base' })
            );

          this.customersOptions.set(options);
        },
        error: () => {
          this.customersOptions.set([]);
        },
      });
  }
}
