import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions'
import { NzTagModule } from 'ng-zorro-antd/tag'

import { OrderRowVm } from '../../../../service/orders/orders-list.types'

@Component({
  selector: 'app-orders-row-details-panel',
  standalone: true,
  imports: [CommonModule, NzDescriptionsModule, NzTagModule],
  templateUrl: './orders-row-details-panel.component.html',
  styleUrl: './orders-row-details-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersRowDetailsPanelComponent {
  @Input({ required: true }) order!: OrderRowVm
}
