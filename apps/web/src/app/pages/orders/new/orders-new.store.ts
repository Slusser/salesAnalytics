import { Injectable, computed, signal } from '@angular/core';

import { computeOrderTotals } from '../../../shared/utils/order-calculation.util';
import type {
  ImportPanelState,
  OrderCalculationInput,
  OrderCalculationResult,
  OrderFormModel,
  OrderFormServerErrors,
  OrdersNewPageState,
} from './orders-new.types';

const DEFAULT_FORM_MODEL: OrderFormModel = {
  orderNo: '',
  customerId: '',
  orderDate: '',
  itemName: '',
  quantity: 1,
  catalogUnitGrossPln: 0,
  producerDiscountPct: 0,
  distributorDiscountPct: 0,
  vatRatePct: 23,
  totalNetPln: 0,
  totalGrossPln: 0,
  distributorPricePln: 0,
  customerPricePln: 0,
  profitPln: 0,
  comment: '',
};

const DEFAULT_IMPORT_STATE: ImportPanelState = {
  status: 'idle',
  fileName: undefined,
  size: undefined,
  mapping: [],
  preview: undefined,
  issues: [],
};

@Injectable()
export class OrdersNewStore {
  private readonly formModelSignal = signal<OrderFormModel>({
    ...DEFAULT_FORM_MODEL,
  });
  private readonly calculationSignal = signal<OrderCalculationResult | null>(
    null
  );
  private readonly dirtySignal = signal(false);
  private readonly submittingSignal = signal(false);
  private readonly serverErrorsSignal = signal<OrderFormServerErrors | null>(
    null
  );
  private readonly importPanelStateSignal = signal<ImportPanelState>({
    ...DEFAULT_IMPORT_STATE,
  });
  private readonly lastResponseSignal =
    signal<OrdersNewPageState['lastResponse']>(undefined);

  readonly formModel = computed(() => this.formModelSignal());
  readonly calculation = computed(() => this.calculationSignal());
  readonly dirty = computed(() => this.dirtySignal());
  readonly submitting = computed(() => this.submittingSignal());
  readonly serverErrors = computed(() => this.serverErrorsSignal());
  readonly importState = computed(() => this.importPanelStateSignal());
  readonly lastResponse = computed(() => this.lastResponseSignal());

  readonly state = computed<OrdersNewPageState>(() => ({
    formModel: this.formModel(),
    calculation: this.calculation(),
    formDirty: this.dirty(),
    submitting: this.submitting(),
    serverErrors: this.serverErrors(),
    importState: this.importState(),
    lastResponse: this.lastResponse(),
  }));

  patchForm(
    partial: Partial<OrderFormModel>,
    options: { markDirty?: boolean } = {}
  ): void {
    const shouldMarkDirty = options.markDirty ?? true;
    this.formModelSignal.update((current) => {
      return {
        ...current,
        ...partial,
      };
    });

    if (shouldMarkDirty) {
      this.markDirty();
    }
  }

  updateCalculationFromInput(input: OrderCalculationInput): void {
    const result = computeOrderTotals(input);
    this.calculationSignal.set(result);
  }

  setCalculation(calculation: OrderCalculationResult | null): void {
    this.calculationSignal.set(calculation);
  }

  markDirty(): void {
    this.dirtySignal.set(true);
  }

  resetDirty(): void {
    this.dirtySignal.set(false);
  }

  setSubmitting(submitting: boolean): void {
    this.submittingSignal.set(submitting);
  }

  setServerErrors(errors: OrderFormServerErrors | null): void {
    this.serverErrorsSignal.set(errors);
  }

  setImportState(state: ImportPanelState): void {
    this.importPanelStateSignal.set({ ...state });
  }

  applyImport(partial: Partial<OrderFormModel>): void {
    this.patchForm(partial);
    this.importPanelStateSignal.update((current) => ({
      ...current,
      status: 'mapped',
    }));
  }

  setLastResponse(response: OrdersNewPageState['lastResponse']): void {
    this.lastResponseSignal.set(response);
  }

  reset(): void {
    this.formModelSignal.set({ ...DEFAULT_FORM_MODEL });
    this.calculationSignal.set(null);
    this.dirtySignal.set(false);
    this.submittingSignal.set(false);
    this.serverErrorsSignal.set(null);
    this.importPanelStateSignal.set({ ...DEFAULT_IMPORT_STATE });
    this.lastResponseSignal.set(undefined);
  }
}
