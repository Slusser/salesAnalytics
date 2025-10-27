import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';

import { OrdersNewStore } from './orders-new.store';
import { OrderFormComponent } from '../../../shared/components/orders/order-form/order-form.component';
import { OrderCalculationPreviewComponent } from '../../../shared/components/orders/order-calculation-preview/order-calculation-preview.component';
import { FxRateBannerComponent } from '../../../shared/components/orders/fx-rate-banner/fx-rate-banner.component';
import type { OrderFormModel } from './orders-new.types';
import type { OrderResponse } from 'apps/shared/dtos/orders.dto';
import { OrdersCreateService } from '../../../service/orders/orders-create.service';
import { FxRateService } from '../../../service/orders/fx-rate.service';

@Component({
  selector: 'app-orders-new-page',
  standalone: true,
  imports: [
    CommonModule,
    NzTypographyModule,
    NzCardModule,
    OrderFormComponent,
    OrderCalculationPreviewComponent,
    FxRateBannerComponent,
  ],
  providers: [OrdersNewStore],
  templateUrl: './orders-new.page.html',
  styleUrl: './orders-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersNewPageComponent {
  private readonly store = inject(OrdersNewStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly ordersCreateService = inject(OrdersCreateService);
  private readonly fxRateService = inject(FxRateService);

  protected readonly state = computed(() => this.store.state());
  protected readonly customers = signal<{ label: string; value: string }[]>([]);

  constructor() {
    effect(() => {
      const snapshot = this.state();
      if (!snapshot) {
        return;
      }

      if (
        snapshot.formModel.currencyCode === 'EUR' &&
        !snapshot.formModel.eurRate &&
        snapshot.fxRate.status === 'idle'
      ) {
        this.requestFxRate(snapshot.formModel.orderDate);
      }
    });
  }

  protected onFormSubmit(model: OrderFormModel): void {
    if (this.state().submitting) {
      return;
    }

    this.store.setSubmitting(true);
    this.store.setServerErrors(null);

    const payload = this.mapFormToPayload(model);
    this.ordersCreateService.create(payload).subscribe({
      next: (response) => this.handleCreateSuccess(response),
      error: (error) => this.handleCreateError(error),
    });
  }

  protected onCancel(): void {
    if (this.state().submitting) {
      return;
    }

    this.router.navigate(['/orders']);
  }

  protected onDirtyChange(dirty: boolean): void {
    if (dirty) {
      this.store.markDirty();
      return;
    }

    this.store.resetDirty();
  }

  protected onRecalculate(input: any): void {
    this.store.updateCalculationFromForm();
  }

  protected onFxRefresh(): void {
    const form = this.state().formModel;
    this.requestFxRate(form.orderDate);
  }

  protected onFxOverrideToggle(enabled: boolean): void {
    this.store.toggleFxManualOverride({ enabled });
  }

  protected onFxOverrideChange(rate: number): void {
    this.store.patchForm({ eurRate: rate });
    this.store.updateCalculationFromForm();
  }

  private requestFxRate(date: string): void {
    if (!date) {
      return;
    }

    this.store.setFxRateState({
      status: 'loading',
      manualOverride: this.state().fxRate.manualOverride,
      rate: this.state().fxRate.rate,
      sourceDate: this.state().fxRate.sourceDate,
    });

    this.fxRateService.getRate({ date }).subscribe({
      next: (rate) => {
        this.store.applyFxRate(rate.rate, rate.date);
      },
      error: (error) => {
        this.store.setFxRateError(error?.message);
        this.message.error('Nie udało się pobrać kursu EUR.');
      },
    });
  }

  private handleCreateSuccess(response: OrderResponse): void {
    this.store.setSubmitting(false);
    this.store.resetDirty();
    this.store.setLastResponse(response);
    this.message.success('Zamówienie zostało utworzone.');
    this.router.navigate(['/orders', response.id]);
  }

  private handleCreateError(error: any): void {
    this.store.setSubmitting(false);
    this.store.setServerErrors(this.mapErrorToForm(error));
    if (!error?.response?.fieldErrors) {
      this.message.error(
        'Nie udało się utworzyć zamówienia. Spróbuj ponownie.'
      );
    }
  }

  private mapFormToPayload(model: OrderFormModel) {
    return {
      orderNo: model.orderNo,
      customerId: model.customerId,
      orderDate: model.orderDate,
      itemName: model.itemName,
      quantity: model.quantity,
      isEur: model.currencyCode === 'EUR',
      eurRate: model.eurRate,
      producerDiscountPct: model.producerDiscountPct,
      distributorDiscountPct: model.distributorDiscountPct,
      vatRatePct: model.vatRatePct,
      totalNetPln: model.totalNetPln,
      totalGrossPln: model.totalGrossPln,
      totalGrossEur: model.totalGrossEur,
      comment: model.comment,
    };
  }

  private mapErrorToForm(error: any) {
    if (!error) {
      return {
        generalError: 'Nie udało się utworzyć zamówienia. Spróbuj ponownie.',
      };
    }

    const status = error.status;
    const response = error.response ?? error.error ?? {};

    if (status === 409) {
      return {
        fieldErrors: { orderNo: 'Numer zamówienia musi być unikalny.' },
      };
    }

    if (status === 400 && Array.isArray(response.details)) {
      const fieldErrors: Record<string, string> = {};
      response.details.forEach((detail: any) => {
        if (detail?.field && detail?.message) {
          fieldErrors[detail.field as string] = detail.message;
        }
      });
      return {
        fieldErrors,
        generalError: response.message,
      };
    }

    if (status === 403) {
      this.router.navigate(['/orders']);
      this.message.error('Brak uprawnień do tworzenia zamówień.');
      return {};
    }

    if (status === 401) {
      this.message.error('Sesja wygasła. Zaloguj się ponownie.');
      this.router.navigate(['/auth/login']);
      return {};
    }

    return {
      generalError:
        response.message ??
        'Nie udało się utworzyć zamówienia. Spróbuj ponownie.',
    };
  }
}
