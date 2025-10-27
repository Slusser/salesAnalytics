import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, NzModalModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Potwierdzenie');
  readonly description = input<string>('Czy na pewno chcesz kontynuować?');
  readonly customerName = input<string>('');
  readonly orderNo = input<string>('');
  readonly confirmLabel = input<string>('Potwierdź');
  readonly cancelLabel = input<string>('Anuluj');
  readonly loading = input<boolean>(false);

  protected readonly hasCustomerName = computed(() => {
    const name = this.customerName();
    if (!name) {
      return false;
    }
    return name.trim().length > 0;
  });

  protected readonly displayCustomerName = computed(() => {
    const name = this.customerName();
    if (!name) {
      return '';
    }
    return name.trim();
  });

  protected readonly hasOrderNo = computed(() => {
    const value = this.orderNo();
    return Boolean(value && value.trim());
  });

  protected readonly displayOrderNo = computed(() => {
    const value = this.orderNo();
    return value ? value.trim() : '';
  });

  protected readonly displayTitle = computed(() => {
    const baseTitle = this.title();
    const name = this.displayCustomerName();
    const orderNo = this.displayOrderNo();

    if (orderNo) {
      return `${baseTitle} – ${orderNo}`;
    }

    if (name) {
      return `${baseTitle} – ${name}`;
    }

    return baseTitle;
  });

  readonly confirm = output<void>({ alias: 'onConfirm' });
  readonly close = output<void>({ alias: 'onClose' });

  protected onCancel(): void {
    this.close.emit();
  }

  protected onOk(): void {
    this.confirm.emit();
  }
}
