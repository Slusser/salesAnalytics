import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import type {
  CustomerRowVm,
  CustomersQueryParamsVm,
} from '../../service/customers/customers.types';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { FilterBarComponent } from '../../shared/components/filter-bar/filter-bar.component';
import { CustomersTableComponent } from '../../shared/components/customers-table/customers-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CustomersService } from '../../service/customers/customers.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    FilterBarComponent,
    CustomersTableComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    NzAlertModule,
    PaginationComponent,
  ],
  templateUrl: './customers.page.html',
  styleUrl: './customers.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersPage {
  private readonly service = inject(CustomersService);
  private readonly router = inject(Router);

  protected readonly roles = this.service.roles;
  protected readonly params = this.service.params;
  protected readonly filters = computed(() => ({
    search: this.params().search,
    includeInactive: this.params().includeInactive,
  }));
  protected readonly loading = this.service.loading;
  protected readonly data = this.service.data;
  protected readonly error = this.service.error;

  protected readonly items = computed<CustomerRowVm[]>(() => {
    const response = this.data();
    if (!response) return [];
    return response.items.map((item) => ({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      defaultDistributorDiscountPct: item.defaultDistributorDiscountPct,
      deleted: Boolean(item.deletedAt),
      deletedAt: item.deletedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  });

  protected readonly total = computed(() => this.data()?.total ?? 0);

  protected readonly showEmpty = computed(
    () => !this.loading() && this.items().length === 0 && !this.error()
  );

  protected readonly showError = computed(() => !!this.error());

  protected readonly confirmDialogOpen = this.service.confirmDialogOpen;
  protected readonly confirmDialogTitle = this.service.confirmDialogTitle;
  protected readonly confirmDialogDescription =
    this.service.confirmDialogDescription;
  protected readonly confirmDialogCustomerName =
    this.service.confirmDialogCustomerName;
  protected readonly confirmDialogLoading = this.service.confirmDialogLoading;

  constructor() {
    this.refreshOnViewEnter();
    effect(() => {
      if (this.showError()) {
        console.error('Customers list error', this.error());
      }
    });
  }

  protected onFilterChange(
    partial: Partial<Pick<CustomersQueryParamsVm, 'search' | 'includeInactive'>>
  ): void {
    this.service.setParams(partial, { resetPage: true });
  }

  protected onClearFilters(): void {
    this.service.resetFilters();
  }

  protected onPageChange(page: number): void {
    this.service.setParams({ page });
  }

  protected onLimitChange(limit: number): void {
    this.service.setParams({ limit }, { resetPage: true });
  }

  protected onEdit(customer: CustomerRowVm): void {
    this.service.navigateToEdit(customer.id);
  }

  protected onSoftDelete(customer: CustomerRowVm): void {
    this.service.askSoftDelete(customer);
  }

  protected onRestore(customer: CustomerRowVm): void {
    this.service.askRestore(customer);
  }

  protected onConfirmDialogConfirm(): void {
    this.service.confirmDialogConfirm();
  }

  protected onConfirmDialogClose(): void {
    this.service.confirmDialogClose();
  }

  protected onRetry(): void {
    this.service.refetch();
  }

  protected canMutate(): boolean {
    return this.service.canMutate();
  }

  protected onCreate(): void {
    if (!this.canMutate() || this.loading()) {
      return;
    }

    this.router.navigate(['/customers/new']);
  }

  private refreshOnViewEnter(): void {
    if (this.service.loading()) {
      return;
    }

    queueMicrotask(() => this.service.refetch());
  }
}
