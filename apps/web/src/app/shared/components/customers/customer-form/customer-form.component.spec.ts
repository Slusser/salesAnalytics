import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NZ_I18N, pl_PL } from 'ng-zorro-antd/i18n';
import pl from '@angular/common/locales/pl';

import { CustomerFormComponent } from './customer-form.component';
import type {
  CustomerFormModel,
  ServerValidationErrors,
} from './customer-form.types';

registerLocaleData(pl);

describe('CustomerFormComponent', () => {
  let fixture: ComponentFixture<CustomerFormComponent>;
  let component: CustomerFormComponent;
  type CustomerFormComponentWithForm = CustomerFormComponent & {
    form: CustomerFormComponent['form'];
  };
  let componentApi: CustomerFormComponentWithForm;

  const getSubmitSpy = () => vi.spyOn(component.submitted, 'emit');
  const getCancelSpy = () => vi.spyOn(component.cancelled, 'emit');
  const getRestoreSpy = () => vi.spyOn(component.restored, 'emit');
  const getSoftDeleteSpy = () => vi.spyOn(component.softDeleted, 'emit');

  const setInput = (key: string, value: unknown) => {
    fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  };

  const submit = () =>
    (component as unknown as { onSubmit(): void }).onSubmit();

  const cancel = () =>
    (component as unknown as { onCancel(): void }).onCancel();

  const restore = () =>
    (component as unknown as { onRestore(): void }).onRestore();

  const softDelete = () =>
    (component as unknown as { onSoftDelete(): void }).onSoftDelete();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomerFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: LOCALE_ID, useValue: 'pl-PL' },
        { provide: NZ_I18N, useValue: pl_PL },
      ],
    });

    fixture = TestBed.createComponent(CustomerFormComponent);
    component = fixture.componentInstance;
    componentApi = component as CustomerFormComponentWithForm;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('inicjalizuje formularz na podstawie przekazanych danych wejściowych', () => {
    const initialValue: CustomerFormModel = {
      name: 'ACME Sp. z o.o.',
      isActive: false,
      comment: 'Ważny kontrahent',
      defaultDistributorDiscountPct: 10,
    };

    setInput('initialValue', initialValue);

    expect(componentApi.form.getRawValue()).toEqual(initialValue);
    expect(componentApi.form.pristine).toBe(true);
    expect(componentApi.form.touched).toBe(false);
  });

  it('oznacza pola jako dotknięte i nie emituje submit, gdy formularz jest niepoprawny', () => {
    componentApi.form.controls.name.setValue('');
    componentApi.form.controls.name.markAsUntouched();

    const submitSpy = getSubmitSpy();

    submit();

    expect(componentApi.form.invalid).toBe(true);
    expect(componentApi.form.controls.name.touched).toBe(true);
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('przycina nazwę kontrahenta i emituje zdarzenie submit dla poprawnych danych', () => {
    const submitSpy = getSubmitSpy();

    componentApi.form.controls.name.setValue('   Nowy kontrahent   ');
    componentApi.form.controls.isActive.setValue(false);
    componentApi.form.controls.comment.setValue('Komentarz testowy');

    submit();

    expect(componentApi.form.controls.name.value).toBe('Nowy kontrahent');
    expect(submitSpy).toHaveBeenCalledWith({
      name: 'Nowy kontrahent',
      isActive: false,
      comment: 'Komentarz testowy',
      defaultDistributorDiscountPct: 0,
    });
  });

  it('blokuje wysyłkę formularza, gdy trwa zapisywanie', () => {
    const submitSpy = getSubmitSpy();

    setInput('submitting', true);
    componentApi.form.controls.name.setValue('Klient');

    submit();

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('blokuje wysyłkę formularza w trybie tylko do odczytu', () => {
    const submitSpy = getSubmitSpy();

    setInput('isReadonly', true);
    componentApi.form.controls.name.setValue('Klient');

    submit();

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('ustawia stany disabled pól formularza zgodnie z wartościami submitting i readonly', () => {
    expect(componentApi.form.controls.name.disabled).toBe(false);
    expect(componentApi.form.controls.isActive.disabled).toBe(false);
    expect(componentApi.form.controls.comment.disabled).toBe(false);

    setInput('submitting', true);

    expect(componentApi.form.controls.name.disabled).toBe(true);
    expect(componentApi.form.controls.isActive.disabled).toBe(true);
    expect(componentApi.form.controls.comment.disabled).toBe(true);

    setInput('submitting', false);
    setInput('isReadonly', true);

    expect(componentApi.form.controls.name.disabled).toBe(true);
    expect(componentApi.form.controls.isActive.disabled).toBe(true);
    expect(componentApi.form.controls.comment.disabled).toBe(true);

    setInput('isReadonly', false);

    expect(componentApi.form.controls.name.disabled).toBe(false);
    expect(componentApi.form.controls.isActive.disabled).toBe(false);
    expect(componentApi.form.controls.comment.disabled).toBe(false);
  });

  it('przypisuje błędy serwera do kontrolek i formularza', () => {
    const serverErrors: ServerValidationErrors = {
      fieldErrors: {
        name: 'Nazwa jest już zajęta',
        isActive: 'Status jest niepoprawny',
      },
      generalError: 'Wystąpił nieznany błąd',
    };

    setInput('serverErrors', serverErrors);

    expect(componentApi.form.hasError('server')).toBe(true);
    expect(componentApi.form.getError('server')).toBe('Wystąpił nieznany błąd');
    expect(componentApi.form.controls.name.getError('server')).toBe(
      'Nazwa jest już zajęta'
    );
    expect(componentApi.form.controls.isActive.getError('server')).toBe(
      'Status jest niepoprawny'
    );
    expect(
      (component as unknown as { generalError(): string }).generalError()
    ).toBe('Wystąpił nieznany błąd');
  });

  it('czyści błędy serwera po zmianie wartości formularza', () => {
    const serverErrors: ServerValidationErrors = {
      fieldErrors: {
        name: 'Nazwa jest już zajęta',
      },
      generalError: 'Wystąpił nieznany błąd',
    };

    setInput('serverErrors', serverErrors);

    componentApi.form.controls.name.setValue('Inna nazwa');
    componentApi.form.controls.isActive.setValue(false);

    expect(componentApi.form.getError('server')).toBeNull();
    expect(componentApi.form.controls.name.getError('server')).toBeNull();
    expect(
      (component as unknown as { generalError(): string }).generalError()
    ).toBe('');
  });

  it('emituje cancelled tylko gdy przycisk anulowania jest dostępny i nie trwa zapisywanie', () => {
    const cancelSpy = getCancelSpy();

    cancel();
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    cancelSpy.mockClear();
    setInput('showCancel', false);

    cancel();
    expect(cancelSpy).not.toHaveBeenCalled();

    setInput('showCancel', true);
    setInput('submitting', true);

    cancel();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('emituje restored tylko gdy przywracanie jest dostępne i nie trwa zapisywanie', () => {
    const restoreSpy = getRestoreSpy();

    restore();
    expect(restoreSpy).not.toHaveBeenCalled();

    setInput('showRestore', true);
    restore();
    expect(restoreSpy).toHaveBeenCalledTimes(1);

    restoreSpy.mockClear();
    setInput('submitting', true);
    restore();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('emituje softDeleted tylko gdy miękkie usuwanie jest dostępne i nie trwa zapisywanie', () => {
    const softDeleteSpy = getSoftDeleteSpy();

    softDelete();
    expect(softDeleteSpy).not.toHaveBeenCalled();

    setInput('showSoftDelete', true);
    softDelete();
    expect(softDeleteSpy).toHaveBeenCalledTimes(1);

    softDeleteSpy.mockClear();
    setInput('submitting', true);
    softDelete();
    expect(softDeleteSpy).not.toHaveBeenCalled();
  });
});


