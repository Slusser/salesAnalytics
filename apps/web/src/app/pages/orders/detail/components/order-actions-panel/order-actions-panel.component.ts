import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzButtonModule } from 'ng-zorro-antd/button';

import type { OrderActionsStateVm } from '../../../../../service/orders/order-detail.types';

@Component({
  selector: 'app-order-actions-panel',
  standalone: true,
  imports: [CommonModule, NzSpaceModule, NzButtonModule],
  templateUrl: './order-actions-panel.component.html',
  styleUrl: './order-actions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderActionsPanelComponent {
  @Input({ required: true }) state!: OrderActionsStateVm;

  @Output() readonly submit = new EventEmitter<void>();
  @Output() readonly reset = new EventEmitter<void>();
  @Output() readonly softDelete = new EventEmitter<void>();
  @Output() readonly restore = new EventEmitter<void>();

  protected onSubmit(): void {
    if (!this.state.canSubmit) {
      return;
    }
    this.submit.emit();
  }

  protected onReset(): void {
    if (!this.state.canReset) {
      return;
    }
    this.reset.emit();
  }

  protected onSoftDelete(): void {
    if (this.state.disableDelete) {
      return;
    }
    this.softDelete.emit();
  }

  protected onRestore(): void {
    if (this.state.disableRestore) {
      return;
    }
    this.restore.emit();
  }
}

