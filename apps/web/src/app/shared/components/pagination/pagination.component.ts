import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { CUSTOMERS_LIMIT_OPTIONS } from '../../../service/customers/customers-list.types';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzPaginationModule,
    NzSelectModule,
    NzFormModule,
  ],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input<number>(1);
  readonly limit = input<number>(CUSTOMERS_LIMIT_OPTIONS[1]);
  readonly total = input<number>(0);
  readonly disabled = input<boolean>(false);
  readonly limitOptions = input<number[]>(CUSTOMERS_LIMIT_OPTIONS);

  readonly pageChange = output<number>();
  readonly limitChange = output<number>();

  protected readonly canPaginate = computed(() => this.total() > 0);

  protected handlePageChange(nextPage: number): void {
    if (this.disabled()) {
      return;
    }

    this.pageChange.emit(nextPage);
  }

  protected handleLimitChange(nextLimit: number): void {
    if (this.disabled()) {
      return;
    }

    this.limitChange.emit(nextLimit);
  }

  protected trackByOption(_: number, value: number): number {
    return value;
  }
}
