import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';

import type { OrderMetadataVm } from '../../../../../service/orders/order-detail.types';

@Component({
  selector: 'app-order-metadata-card',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzDescriptionsModule, NzTagModule, NzIconModule],
  templateUrl: './order-metadata-card.component.html',
  styleUrl: './order-metadata-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderMetadataCardComponent {
  @Input({ required: true }) metadata!: OrderMetadataVm;

  protected isDeleted(): boolean {
    return Boolean(this.metadata.deletedAt);
  }
}

