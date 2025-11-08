import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NzPageHeaderModule } from 'ng-zorro-antd/page-header';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';

import type {
  OrderMetadataVm,
  OrderRolePermissionsVm,
} from '../../../../../service/orders/order-detail.types';

@Component({
  selector: 'app-order-detail-header',
  standalone: true,
  imports: [CommonModule, NzPageHeaderModule, NzButtonModule, NzTagModule, NzIconModule],
  templateUrl: './order-detail-header.component.html',
  styleUrl: './order-detail-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailHeaderComponent {
  @Input({ required: true }) metadata!: OrderMetadataVm;
  @Input({ required: true }) permissions!: OrderRolePermissionsVm;
  @Input() loadingMutation = false;

  @Output() readonly back = new EventEmitter<void>();

  protected onBack(): void {
    this.back.emit();
  }

  protected isDeleted(): boolean {
    return Boolean(this.metadata.deletedAt);
  }
}

