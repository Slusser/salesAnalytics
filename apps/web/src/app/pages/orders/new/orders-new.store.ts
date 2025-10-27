import { Injectable, computed, effect, signal } from '@angular/core';

import { computeOrderTotals } from '../../../shared/utils/order-calculation.util';
import type {
  FxRateOverride,
  FxRateState,
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
  currencyCode: 'PLN',
  eurRate: undefined,
  producerDiscountPct: 0,
  distributorDiscountPct: 0,
  vatRatePct: 23,
  totalNetPln: 0,
  totalGrossPln: 0,
  totalGrossEur: undefined,
  comment: '',
  isEur: false,
};

const DEFAULT_FX_STATE: FxRateState = {
  status: 'idle',
  manualOverride: false,
  rate: undefined,
  sourceDate: undefined,
  message: undefined,
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
  private readonly fxRateStateSignal = signal<FxRateState>({
    ...DEFAULT_FX_STATE,
  });
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
  readonly fxRateState = computed(() => this.fxRateStateSignal());
  readonly importState = computed(() => this.importPanelStateSignal());
  readonly lastResponse = computed(() => this.lastResponseSignal());

  readonly state = computed<OrdersNewPageState>(() => ({
    formModel: this.formModel(),
    calculation: this.calculation(),
    formDirty: this.dirty(),
    submitting: this.submitting(),
    serverErrors: this.serverErrors(),
    fxRate: this.fxRateState(),
    importState: this.importState(),
    lastResponse: this.lastResponse(),
  }));

  constructor() {
    effect(() => {
      const form = this.formModelSignal();
      const isEur = form.currencyCode === 'EUR';
      if (form.isEur !== isEur) {
        this.formModelSignal.update((current) => ({ ...current, isEur }));
      }
    });
  }

  patchForm(
    partial: Partial<OrderFormModel>,
    options: { markDirty?: boolean } = {}
  ): void {
    const shouldMarkDirty = options.markDirty ?? true;
    this.formModelSignal.update((current) => {
      const merged = { ...current, ...partial };
      if (merged.currencyCode === 'EUR' && !merged.isEur) {
        merged.isEur = true;
      }

      if (merged.currencyCode === 'PLN') {
        merged.isEur = false;
        merged.eurRate = undefined;
        merged.totalGrossEur = undefined;
      }

      return merged;
    });

    if (shouldMarkDirty) {
      this.markDirty();
    }
  }

  updateCalculationFromForm(): void {
    const model = this.formModelSignal();
    const input: OrderCalculationInput = {
      net: model.totalNetPln,
      producerDiscountPct: model.producerDiscountPct,
      distributorDiscountPct: model.distributorDiscountPct,
      vatRatePct: model.vatRatePct,
      currency: model.currencyCode,
      eurRate: model.eurRate,
    };
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

  setFxRateState(state: FxRateState): void {
    this.fxRateStateSignal.set({ ...state });
  }

  applyFxRate(rate: number, sourceDate: string): void {
    this.fxRateStateSignal.set({
      status: 'loaded',
      rate,
      sourceDate,
      manualOverride: false,
    });
    this.patchForm(
      {
        currencyCode: 'EUR',
        eurRate: rate,
      },
      { markDirty: false }
    );
  }

  setFxRateError(message?: string): void {
    this.fxRateStateSignal.set({
      status: 'error',
      manualOverride: this.fxRateStateSignal().manualOverride,
      rate: this.fxRateStateSignal().rate,
      sourceDate: this.fxRateStateSignal().sourceDate,
      message,
    });
  }

  toggleFxManualOverride(override: FxRateOverride): void {
    this.fxRateStateSignal.update((current) => ({
      ...current,
      manualOverride: override.enabled,
      status: override.enabled ? 'loaded' : current.status,
      message: undefined,
      rate: override.enabled ? override.rate : current.rate,
    }));

    this.patchForm(
      {
        currencyCode: override.enabled
          ? 'EUR'
          : this.formModelSignal().currencyCode,
        eurRate: override.enabled
          ? override.rate
          : this.formModelSignal().eurRate,
      },
      { markDirty: true }
    );
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
    this.fxRateStateSignal.set({ ...DEFAULT_FX_STATE });
    this.importPanelStateSignal.set({ ...DEFAULT_IMPORT_STATE });
    this.lastResponseSignal.set(undefined);
  }
}
