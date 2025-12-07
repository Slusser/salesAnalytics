import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NZ_I18N, pl_PL } from 'ng-zorro-antd/i18n';
import pl from '@angular/common/locales/pl';

import { OrderFormComponent } from './order-form.component';
import type {
  OrderCalculationInput,
  OrderFormModel,
  OrderFormServerErrors,
} from '../../../../pages/orders/new/orders-new.types';
import { CustomersService } from '../../../../service/customers/customers.service';

registerLocaleData(pl);

describe('OrderFormComponent', () => {
  let fixture: ComponentFixture<OrderFormComponent>;
  let component: OrderFormComponent;
  type OrderFormComponentWithForm = OrderFormComponent & {
    form: OrderFormComponent['form'];
  };
  let componentApi: OrderFormComponentWithForm;
  let customersService: { get: ReturnType<typeof vi.fn> };

  const baseModel: OrderFormModel = {
    orderNo: 'ORD-001',
    customerId: 'customer-1',
    orderDate: '2024-05-20',
    itemName: 'Produkt testowy',
    quantity: 5,
    catalogUnitGrossPln: 300,
    producerDiscountPct: 10,
    distributorDiscountPct: 5,
    vatRatePct: 23,
    totalNetPln: 1000,
    totalGrossPln: 1230,
    distributorPricePln: 950,
    customerPricePln: 1200,
    profitPln: 250,
  };

  const createComponent = (model: OrderFormModel = baseModel) => {
    fixture = TestBed.createComponent(OrderFormComponent);
    component = fixture.componentInstance;
    componentApi = component as OrderFormComponentWithForm;
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  };

  const getCustomersOptions = () =>
    (component as unknown as {
      customersOptions(): { label: string; value: string }[];
    }).customersOptions();

  const setComponentInput = (key: string, value: unknown) => {
    fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  };

  const submit = () =>
    (component as unknown as { onSubmit(): void }).onSubmit();

  const cancel = () =>
    (component as unknown as { onCancel(): void }).onCancel();

  beforeEach(() => {
    customersService = {
      get: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [OrderFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: LOCALE_ID, useValue: 'pl-PL' },
        { provide: NZ_I18N, useValue: pl_PL },
        { provide: CustomersService, useValue: customersService },
      ],
    });
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
    }
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ładuje i sortuje aktywnych kontrahentów', () => {
    const customers = [
      { id: '2', name: 'Beta', isActive: true },
      { id: '3', name: 'Nieaktywny', isActive: false },
      { id: '1', name: 'alpha', isActive: true },
    ];
    customersService.get.mockReturnValue(of(customers as any));

    createComponent();

    expect(customersService.get).toHaveBeenCalledWith({ limit: 1000 });
    expect(getCustomersOptions()).toEqual([
      { label: 'alpha', value: '1' },
      { label: 'Beta', value: '2' },
    ]);
  });

  it('ustawia pustą listę kontrahentów i loguje błąd, gdy pobieranie się nie powiedzie', () => {
    const error = new Error('Błąd sieci');
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    customersService.get.mockReturnValue(throwError(() => error));

    createComponent();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Nie udało się pobrać listy kontrahentów.',
      error
    );
    expect(getCustomersOptions()).toEqual([]);
  });

  it('inicjalizuje formularz wartościami wejściowymi i resetuje stany kontrolek', () => {
    createComponent();

    expect(componentApi.form.getRawValue()).toEqual({
      orderNo: baseModel.orderNo,
      customerId: baseModel.customerId,
      orderDate: baseModel.orderDate,
      itemName: baseModel.itemName,
      quantity: baseModel.quantity,
      catalogUnitGrossPln: baseModel.catalogUnitGrossPln,
      producerDiscountPct: baseModel.producerDiscountPct,
      distributorDiscountPct: baseModel.distributorDiscountPct,
      vatRatePct: baseModel.vatRatePct,
      totalNetPln: baseModel.totalNetPln,
      totalGrossPln: baseModel.totalGrossPln,
      distributorPricePln: baseModel.distributorPricePln,
      customerPricePln: baseModel.customerPricePln,
      profitPln: baseModel.profitPln,
      comment: null,
    });
    expect(componentApi.form.pristine).toBe(true);
    expect(componentApi.form.touched).toBe(false);
  });

  it('oznacza formularz i nie emituje submit, gdy dane są niepoprawne', () => {
    createComponent();
    componentApi.form.controls.orderNo.setValue('');

    const submitSpy = vi.spyOn(component.submitted, 'emit');

    submit();

    expect(componentApi.form.invalid).toBe(true);
    expect(componentApi.form.controls.orderNo.touched).toBe(true);
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('przycina tekst i wysyła dane w PLN', () => {
    createComponent({
      ...baseModel,
      comment: 'Zamówienie bazowe',
    });

    const submitSpy = vi.spyOn(component.submitted, 'emit');

    componentApi.form.controls.orderNo.setValue('   ORD-XYZ   ');
    componentApi.form.controls.itemName.setValue('   Lampa biurkowa   ');
    componentApi.form.controls.comment.setValue('Notatka wewnętrzna');
    componentApi.form.controls.quantity.setValue(2);
    componentApi.form.controls.producerDiscountPct.setValue(15);
    componentApi.form.controls.distributorDiscountPct.setValue(5);
    componentApi.form.controls.vatRatePct.setValue(8);
    componentApi.form.controls.totalNetPln.setValue(500);
    componentApi.form.controls.totalGrossPln.setValue(540);

    submit();

    expect(submitSpy).toHaveBeenCalledWith({
      orderNo: 'ORD-XYZ',
      customerId: baseModel.customerId,
      orderDate: baseModel.orderDate,
      itemName: 'Lampa biurkowa',
      quantity: 2,
      catalogUnitGrossPln: baseModel.catalogUnitGrossPln,
      producerDiscountPct: 15,
      distributorDiscountPct: 5,
      vatRatePct: 8,
      totalNetPln: 500,
      totalGrossPln: 540,
      distributorPricePln: baseModel.distributorPricePln,
      customerPricePln: baseModel.customerPricePln,
      profitPln: baseModel.profitPln,
      comment: 'Notatka wewnętrzna',
    });
  });

  it('emituje cancelled, gdy formularz zostanie anulowany i nie trwa zapisywanie', () => {
    createComponent();

    const cancelSpy = vi.spyOn(component.cancelled, 'emit');

    cancel();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('blokuje submit i cancel podczas zapisywania', () => {
    createComponent();

    const submitSpy = vi.spyOn(component.submitted, 'emit');
    const cancelSpy = vi.spyOn(component.cancelled, 'emit');

    setComponentInput('submitting', true);

    expect(componentApi.form.disabled).toBe(true);

    submit();
    cancel();

    expect(submitSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();

    setComponentInput('submitting', false);

    expect(componentApi.form.disabled).toBe(false);
  });

  it('przypisuje błędy serwera do kontrolek i czyści je po zmianie', () => {
    vi.useFakeTimers();
    createComponent();

    const serverErrors: OrderFormServerErrors = {
      generalError: 'Wystąpił błąd serwera',
      fieldErrors: {
        orderNo: 'Numer jest zajęty',
        totalGrossPln: 'Kwota brutto jest niepoprawna',
      },
    };

    setComponentInput('serverErrors', serverErrors);

    expect(componentApi.form.hasError('server')).toBe(true);
    expect(componentApi.form.getError('server')).toBe('Wystąpił błąd serwera');
    expect(componentApi.form.controls.orderNo.getError('server')).toBe(
      'Numer jest zajęty'
    );
    expect(componentApi.form.controls.totalGrossPln.getError('server')).toBe(
      'Kwota brutto jest niepoprawna'
    );
    expect(
      (component as unknown as { hasServerErrors(): boolean }).hasServerErrors()
    ).toBe(true);
    expect(
      (component as unknown as { generalError(): string }).generalError()
    ).toBe('Wystąpił błąd serwera');

    componentApi.form.controls.orderNo.setValue('ORD-NEW');

    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    expect(componentApi.form.getError('server')).toBeNull();
    expect(componentApi.form.controls.orderNo.getError('server')).toBeNull();
    expect(
      (component as unknown as { hasServerErrors(): boolean }).hasServerErrors()
    ).toBe(false);
    expect(
      (component as unknown as { generalError(): string }).generalError()
    ).toBe('');

    vi.useRealTimers();
  });

  it('emituje dirtyChange przy zmianie wartości formularza', () => {
    createComponent();

    const dirtySpy = vi.spyOn(component.dirtyChange, 'emit');

    componentApi.form.controls.quantity.setValue(6);

    expect(dirtySpy).toHaveBeenLastCalledWith(true);
  });

  it('emituje żądanie przeliczenia po zmianie pól finansowych', () => {
    vi.useFakeTimers();
    createComponent();

    const recalcSpy = vi.spyOn(component.recalculate, 'emit');

    componentApi.form.controls.catalogUnitGrossPln.setValue(420);
    componentApi.form.controls.quantity.setValue(7);
    componentApi.form.controls.producerDiscountPct.setValue(12);
    componentApi.form.controls.distributorDiscountPct.setValue(3);
    componentApi.form.controls.vatRatePct.setValue(8);

    vi.advanceTimersByTime(350);

    const expected: OrderCalculationInput = {
      catalogUnitGrossPln: 420,
      quantity: 7,
      producerDiscountPct: 12,
      distributorDiscountPct: 3,
      vatRatePct: 8,
    };

    expect(recalcSpy).toHaveBeenCalledTimes(1);
    expect(recalcSpy).toHaveBeenCalledWith(expected);

    vi.useRealTimers();
  });
});

