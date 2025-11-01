import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

import {
  OrderRowVm,
  OrdersRolePermissionsVm,
  OrdersSortState,
} from '../../../../service/orders/orders-list.types';
import { OrdersRowDetailsPanelComponent } from '../orders-row-details-panel/orders-row-details-panel.component';

@Component({
  selector: 'app-orders-data-table',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzToolTipModule,
    OrdersRowDetailsPanelComponent,
  ],
  templateUrl: './orders-data-table.component.html',
  styleUrl: './orders-data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersDataTableComponent {
  @Input({ required: true }) rows!: OrderRowVm[];
  @Input({ required: true }) sort!: OrdersSortState;
  @Input({ required: true }) loading!: boolean;
  @Input({ required: true }) permissions!: OrdersRolePermissionsVm;
  @Input({ required: true }) expandedRowId!: string | null;

  @Output() readonly sortChange = new EventEmitter<OrdersSortState>();
  @Output() readonly rowToggle = new EventEmitter<string>();
  @Output() readonly edit = new EventEmitter<string>();
  @Output() readonly softDelete = new EventEmitter<string>();
  @Output() readonly restore = new EventEmitter<string>();

  protected onHeaderSort(field: OrdersSortState['field']): void {
    if (this.loading) {
      return;
    }

    const direction =
      this.sort.field === field && this.sort.direction === 'asc'
        ? 'desc'
        : 'asc';
    this.sortChange.emit({ field, direction });
  }

  protected onRowToggle(orderId: string): void {
    this.rowToggle.emit(orderId);
  }

  protected onEdit(orderId: string): void {
    if (!this.permissions.canMutate) {
      return;
    }

    this.edit.emit(orderId);
  }

  protected onSoftDelete(orderId: string): void {
    if (!this.permissions.canMutate) {
      return;
    }

    this.softDelete.emit(orderId);
  }

  protected onRestore(orderId: string): void {
    if (!this.permissions.canMutate) {
      return;
    }

    this.restore.emit(orderId);
  }

  protected isExpanded(orderId: string): boolean {
    return this.expandedRowId === orderId;
  }

  protected isSorted(
    field: OrdersSortState['field'],
    direction: OrdersSortState['direction']
  ): boolean {
    return this.sort.field === field && this.sort.direction === direction;
  }
}
