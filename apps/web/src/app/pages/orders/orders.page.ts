import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { OrdersListService } from '../../service/orders/orders-list.service';
import { OrdersToolbarComponent } from './shared/orders-toolbar/orders-toolbar.component';
import { OrdersDataTableComponent } from './shared/orders-data-table/orders-data-table.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ManualRefreshButtonComponent } from '../../shared/components/manual-refresh-button/manual-refresh-button.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    CommonModule,
    NzAlertModule,
    NzButtonModule,
    OrdersToolbarComponent,
    OrdersDataTableComponent,
    PaginationComponent,
    ManualRefreshButtonComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  private readonly ordersService = inject(OrdersListService);
  private readonly router = inject(Router);

  protected readonly params = this.ordersService.params;
  protected readonly data = this.ordersService.data;
  protected readonly loading = this.ordersService.loading;
  protected readonly error = this.ordersService.error;
  protected readonly permissions = this.ordersService.permissions;
  protected readonly total = this.ordersService.total;
  protected readonly items = this.ordersService.items;
  protected readonly expandedRowId = this.ordersService.expandedRowId;

  protected readonly showEmpty = computed(
    () => !this.loading() && !this.error() && this.items().length === 0
  );
  protected readonly showError = computed(() => Boolean(this.error()));

  protected readonly confirmDialogOpen = this.ordersService.confirmDialogOpen;
  protected readonly confirmDialogTitle = this.ordersService.confirmDialogTitle;
  protected readonly confirmDialogDescription =
    this.ordersService.confirmDialogDescription;
  protected readonly confirmDialogOrderNo =
    this.ordersService.confirmDialogOrderNo;
  protected readonly confirmDialogLoading =
    this.ordersService.confirmDialogLoading;

  protected readonly exportInProgress = this.ordersService.exportInProgress;

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state?.['refresh']) {
      queueMicrotask(() => this.ordersService.refetch());
    }

    effect(() => {
      if (this.showError()) {
        console.error('Orders list error', this.error());
      }
    });
  }

  protected onFiltersChange(
    partial: Parameters<OrdersListService['setFilterFormState']>[0]
  ): void {
    this.ordersService.setFilterFormState(partial);
  }

  protected onFiltersReset(): void {
    this.ordersService.resetFilters();
  }

  protected onIncludeDeletedToggle(include: boolean): void {
    this.ordersService.toggleIncludeDeleted(include);
  }

  protected onManualRefresh(): void {
    this.ordersService.refetch();
  }

  protected onSortChange(
    sort: Parameters<OrdersListService['handleSortChange']>[0]
  ): void {
    this.ordersService.handleSortChange(sort);
  }

  protected onRowToggle(orderId: string): void {
    const current = this.expandedRowId();
    this.ordersService.setExpandedRow(current === orderId ? null : orderId);
  }

  protected canMutate(): boolean {
    return this.ordersService.canMutate();
  }

  protected onCreate(): void {
    if (!this.ordersService.canMutate() || this.loading()) {
      return;
    }

    this.router.navigate(['/orders/new']);
  }

  protected onEdit(orderId: string): void {
    if (!this.ordersService.canMutate()) {
      return;
    }

    this.router.navigate(['/orders', orderId, 'edit']);
  }

  protected onSoftDelete(orderId: string): void {
    const order = this.items().find((row) => row.id === orderId);
    if (!order) {
      return;
    }

    this.ordersService.askSoftDelete(order);
  }

  protected onRestore(orderId: string): void {
    const order = this.items().find((row) => row.id === orderId);
    if (!order) {
      return;
    }

    this.ordersService.askRestore(order);
  }

  protected onPageChange(page: number): void {
    this.ordersService.handlePaginationChange(page);
  }

  protected onLimitChange(limit: number): void {
    this.ordersService.handlePaginationChange(1, limit);
  }

  protected onConfirmDialogConfirm(): void {
    this.ordersService.confirmDialogConfirm();
  }

  protected onConfirmDialogClose(): void {
    this.ordersService.confirmDialogClose();
  }

  protected onRetry(): void {
    this.ordersService.refetch();
  }
}
