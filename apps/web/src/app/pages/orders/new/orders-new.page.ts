import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';

import { OrdersNewStore } from './orders-new.store';
import { OrderFormComponent } from '../../../shared/components/orders/order-form/order-form.component';
import { OrderCalculationPreviewComponent } from '../../../shared/components/orders/order-calculation-preview/order-calculation-preview.component';
import type {
  OrderCalculationInput,
  OrderCalculationResult,
  OrderFormModel,
} from './orders-new.types';
import type { OrderResponse } from '@shared/dtos/orders.dto';
import { OrdersCreateService } from '../../../service/orders/orders-create.service';

@Component({
  selector: 'app-orders-new-page',
  standalone: true,
  imports: [
    CommonModule,
    NzTypographyModule,
    NzCardModule,
    OrderFormComponent,
    OrderCalculationPreviewComponent,
  ],
  providers: [OrdersNewStore],
  templateUrl: './orders-new.page.html',
  styleUrl: './orders-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersNewPageComponent {
  public static readonly EMPTY_CALCULATION: OrderCalculationResult = {
    totalGrossPln: 0,
    totalNetPln: 0,
    distributorPricePln: 0,
    customerPricePln: 0,
    profitPln: 0,
    vatAmount: 0,
  };

  private readonly store = inject(OrdersNewStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly ordersCreateService = inject(OrdersCreateService);

  protected readonly state = computed(() => this.store.state());
  protected readonly calculationPreview = computed(
    () => this.store.calculation() ?? OrdersNewPageComponent.EMPTY_CALCULATION
  );

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

  protected onRecalculate(input: OrderCalculationInput): void {
    this.store.updateCalculationFromInput(input);
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
      catalogUnitGrossPln: model.catalogUnitGrossPln,
      producerDiscountPct: model.producerDiscountPct,
      distributorDiscountPct: model.distributorDiscountPct,
      vatRatePct: model.vatRatePct,
      totalNetPln: model.totalNetPln,
      totalGrossPln: model.totalGrossPln,
      distributorPricePln: model.distributorPricePln,
      customerPricePln: model.customerPricePln,
      profitPln: model.profitPln,
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
