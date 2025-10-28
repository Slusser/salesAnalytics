import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { CommonModule, DatePipe } from '@angular/common';

import type { CustomerRowVm } from '../../../service/customers/customers.types';
import type { AppRole } from '@shared/dtos/user-roles.dto';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

@Component({
  selector: 'app-customers-table',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzTagModule,
    NzIconModule,
    DatePipe,
    NzTooltipModule,
  ],
  templateUrl: './customers-table.component.html',
  styleUrl: './customers-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersTableComponent {
  readonly items = input<CustomerRowVm[]>([]);
  readonly role = input<AppRole[]>([]);
  readonly loading = input<boolean>(false);

  readonly edit = output<CustomerRowVm>();
  readonly softDelete = output<CustomerRowVm>();
  readonly restore = output<CustomerRowVm>();

  protected readonly canMutate = computed(() => {
    const roles: string[] = this.role();
    return roles.includes('owner') || roles.includes('editor');
  });

  protected onEdit(customer: CustomerRowVm): void {
    this.edit.emit(customer);
  }

  protected onSoftDelete(customer: CustomerRowVm): void {
    this.softDelete.emit(customer);
  }

  protected onRestore(customer: CustomerRowVm): void {
    this.restore.emit(customer);
  }
}
