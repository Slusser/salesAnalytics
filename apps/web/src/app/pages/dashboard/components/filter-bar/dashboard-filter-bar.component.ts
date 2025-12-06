import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { DashboardFilters } from '../../../../service/analytics/dashboard-store.types';
import { CustomerOption } from '../../dashboard.types';

type FilterFormValue = {
  customerId: string | null;
  dateRange: [Date, Date] | null;
};

@Component({
  selector: 'app-dashboard-filter-bar',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './dashboard-filter-bar.component.html',
  styleUrl: './dashboard-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardFilterBarComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input.required<DashboardFilters>();
  readonly customerOptions = input<CustomerOption[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  readonly canFilterByCustomer = input<boolean>(true);

  readonly filtersChanged = output<DashboardFilters>();
  readonly filtersSubmitted = output<DashboardFilters>();
  readonly filtersReset = output<void>();

  protected readonly form = this.fb.group({
    customerId: [null as string | null],
    dateRange: [null as [Date, Date] | null, Validators.required],
  });
  protected readonly customerSelectDisabled = computed(
    () => this.isDisabled() || !this.canFilterByCustomer()
  );

  constructor() {
    effect(
      () => {
        this.syncFormWithValue(this.value());
      },
      { allowSignalWrites: true }
    );

    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const filters = this.getNormalizedFilters();
        if (!filters) {
          return;
        }
        this.filtersChanged.emit(filters);
      });
  }

  protected onSubmit(): void {
    const filters = this.getNormalizedFilters();
    if (!filters) {
      this.form.markAllAsTouched();
      return;
    }

    this.filtersSubmitted.emit(filters);
  }

  protected onResetClick(): void {
    this.filtersReset.emit();
  }

  protected isApplyDisabled(): boolean {
    return this.isLoading() || this.isDisabled() || !this.form.valid;
  }

  private syncFormWithValue(filters: DashboardFilters): void {
    const currentRange = this.form.controls.dateRange.value;
    const nextRange = this.createDateRange(filters);

    const customerIdControl = this.form.controls.customerId;
    const hasCustomerChange =
      (customerIdControl.value ?? null) !== (filters.customerId ?? null);

    const hasRangeChange =
      !currentRange ||
      !nextRange ||
      currentRange[0].getTime() !== nextRange[0].getTime() ||
      currentRange[1].getTime() !== nextRange[1].getTime();

    if (!hasCustomerChange && !hasRangeChange) {
      return;
    }

    this.form.patchValue(
      {
        customerId: filters.customerId ?? null,
        dateRange: nextRange,
      },
      { emitEvent: false }
    );
  }

  private getNormalizedFilters(): DashboardFilters | null {
    const raw = this.form.getRawValue() as FilterFormValue;
    if (!raw.dateRange) {
      return null;
    }

    const [from, to] = raw.dateRange;
    if (!from || !to) {
      return null;
    }

    const dateFrom = this.formatIsoDate(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
    );
    const dateTo = this.formatIsoDate(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)
    );

    if (!dateFrom || !dateTo) {
      return null;
    }

    return {
      dateFrom,
      dateTo,
      customerId: raw.customerId ?? undefined,
    };
  }

  private createDateRange(filters: DashboardFilters): [Date, Date] {
    const from = this.parseIso(filters.dateFrom);
    const to = this.parseIso(filters.dateTo);
    return [from, to];
  }

  private parseIso(value: string): Date {
    return new Date(`${value}T00:00:00Z`);
  }

  private formatIsoDate(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}


