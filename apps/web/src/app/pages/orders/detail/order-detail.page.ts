import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzResultModule } from 'ng-zorro-antd/result';

import { OrderDetailStore } from '../../../service/orders/order-detail.store';
import { OrderDetailHeaderComponent } from './components/order-detail-header/order-detail-header.component';
import { OrderActionsPanelComponent } from './components/order-actions-panel/order-actions-panel.component';
import { SkeletonDetailComponent } from './components/skeleton-detail/skeleton-detail.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

import type { OrderDetailCanDeactivate } from './order-detail.can-deactivate.guard';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzResultModule,
    OrderDetailHeaderComponent,
    OrderActionsPanelComponent,
    SkeletonDetailComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OrderDetailStore],
})
export class OrderDetailPageComponent implements OrderDetailCanDeactivate {
  private readonly store = inject(OrderDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly status = this.store.status;
  protected readonly orderDetail = this.store.orderDetail;
  protected readonly error = this.store.error;
  protected readonly permissions = this.store.permissions;
  protected readonly formState = this.store.formState;
  protected readonly auditState = this.store.auditState;
  protected readonly confirmDialog = this.store.confirmDialog;
  protected readonly navigationBlocked = this.store.navigationBlocked;
  protected readonly isLoading = computed(() => this.status() === 'loading');
  protected readonly confirmDialogTitle = computed(() =>
    this.confirmDialog().mode === 'restore' ? 'Przywracanie zamówienia' : 'Usunięcie zamówienia',
  );
  protected readonly confirmDialogDescription = computed(() => this.confirmDialog().message);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('orderId')),
        takeUntilDestroyed(),
      )
      .subscribe((orderId) => this.store.load(orderId));
  }

  canDeactivate(): boolean {
    if (!this.store.shouldBlockNavigation()) {
      return true;
    }

    if (typeof window === 'undefined') {
      return false;
    }

    return window.confirm(
      'Masz niezapisane zmiany w formularzu zamówienia. Czy na pewno chcesz opuścić stronę?',
    );
  }

  protected onRefresh(): void {
    this.store.refresh();
  }

  protected onBack(): void {
    this.router.navigate(['/orders']);
  }

  protected onSubmit(): void {
    this.store.submit();
  }

  protected onReset(): void {
    this.store.resetForm();
  }

  protected onSoftDelete(): void {
    this.store.openDeleteDialog();
  }

  protected onRestore(): void {
    this.store.openRestoreDialog();
  }

  protected onOpenAudit(): void {
    this.store.toggleAuditVisibility();
  }

  protected onConfirmDialogConfirm(): void {
    this.store.confirmMutation();
  }

  protected onConfirmDialogClose(): void {
    this.store.cancelDialog();
  }

  protected canShowActions(): boolean {
    const detail = this.orderDetail();
    return Boolean(detail);
  }
}

