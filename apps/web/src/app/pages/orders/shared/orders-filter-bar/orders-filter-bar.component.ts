import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  Subscription,
} from 'rxjs';

import {
  ORDERS_MAX_ORDER_NO_LENGTH,
  OrdersFilterFormState,
} from '../../../../service/orders/orders-list.types';

interface FilterFormValue {
  orderNo: string | null;
  dateRange: [Date | null, Date | null] | null;
}

type FilterFormGroup = FormGroup<{
  orderNo: FormControl<string | null>;
  dateRange: FormControl<[Date | null, Date | null] | null>;
}>;

const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-orders-filter-bar',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzInputModule,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
  ],
  templateUrl: './orders-filter-bar.component.html',
  styleUrl: './orders-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersFilterBarComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) value!: OrdersFilterFormState;
  @Input({ required: true }) disabled!: boolean;

  @Output() readonly filtersChange = new EventEmitter<
    Partial<OrdersFilterFormState>
  >();
  @Output() readonly resetRequested = new EventEmitter<void>();

  private subscription = new Subscription();

  protected readonly form = signal<FilterFormGroup | null>(null);
  protected readonly orderNoMaxLength = ORDERS_MAX_ORDER_NO_LENGTH;

  protected readonly orderNoInvalid = computed(() => {
    const control = this.form()?.get('orderNo');
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  });

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected onReset(): void {
    this.resetRequested.emit();
  }

  private initializeForm(): void {
    const form = this.fb.group({
      orderNo: this.fb.control<string | null>(this.value.orderNo ?? null, {
        validators: [Validators.maxLength(ORDERS_MAX_ORDER_NO_LENGTH)],
      }),
      dateRange: this.fb.control<[Date | null, Date | null] | null>(
        this.toDateRange(this.value.dateRange)
      ),
    });

    this.form.set(form);

    form.disable({ emitEvent: false });
    if (!this.disabled) {
      form.enable({ emitEvent: false });
    }

    this.subscription.add(
      form.valueChanges
        .pipe(
          debounceTime(DEBOUNCE_MS),
          distinctUntilChanged(),
          filter((value): value is FilterFormValue => {
            if (!form.valid) {
              return false;
            }

            return true;
          }),
          map(
            (value): Partial<OrdersFilterFormState> => ({
              orderNo: value.orderNo ?? undefined,
              dateRange: this.normalizeDateRange(value.dateRange),
            })
          )
        )
        .subscribe((partial) => this.filtersChange.emit(partial))
    );
  }

  private toDateRange(
    range: OrdersFilterFormState['dateRange']
  ): [Date | null, Date | null] | null {
    if (!range || range.length !== 2) {
      return null;
    }

    const [from, to] = range;
    return [from ? new Date(from) : null, to ? new Date(to) : null];
  }

  private normalizeDateRange(
    range: [Date | null, Date | null] | null
  ): [string, string] | undefined {
    if (!range || range.length !== 2) {
      return undefined;
    }

    const [from, to] = range;

    if (!from || !to) {
      return undefined;
    }

    return [from.toISOString(), to.toISOString()];
  }
}
