import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { UpdateCustomerCommand } from '@shared/dtos/customers.dto';
import type { AppRole } from '@shared/dtos/user-roles.dto';

import { CustomersService } from '../../service/customers/customers.service';
import { AuthSessionService } from '../../service/auth/auth-session.service';
import type {
  ApiError,
  CustomerViewModel,
} from '../../shared/types/customers.view-model';
import { mapToViewModel } from '../../shared/types/customers.view-model';
import type {
  CustomerFormModel,
  ServerValidationErrors,
} from '../../shared/components/customers/customer-form/customer-form.types';
import { CustomerFormComponent } from '../../shared/components/customers/customer-form/customer-form.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

const CUSTOMER_NAME_PATTERN = /^[\p{L}\p{M}\p{N}\s\-_'.,&()/]+$/u;

interface PageState {
  customer: CustomerViewModel | null;
  loading: boolean;
  error: ApiError | null;
  saving: boolean;
  deleting: boolean;
  restoreInProgress: boolean;
  showDeleteDialog: boolean;
  notFound: boolean;
  formErrors: ServerValidationErrors | null;
}

@Component({
  selector: 'app-customer-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    NzCardModule,
    NzAlertModule,
    NzTagModule,
    NzButtonModule,
    CustomerFormComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './customer-detail.page.html',
  styleUrl: './customer-detail.page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CustomersService);
  private readonly message = inject(NzMessageService);
  private readonly authSession = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<PageState>({
    customer: null,
    loading: true,
    error: null,
    saving: false,
    deleting: false,
    restoreInProgress: false,
    showDeleteDialog: false,
    notFound: false,
    formErrors: null,
  });

  protected readonly customer = computed(() => this.state().customer);
  protected readonly loading = computed(() => this.state().loading);
  protected readonly error = computed(() => this.state().error);
  protected readonly saving = computed(() => this.state().saving);
  protected readonly deleting = computed(() => this.state().deleting);
  protected readonly restoreInProgress = computed(
    () => this.state().restoreInProgress
  );
  protected readonly showDeleteDialog = computed(
    () => this.state().showDeleteDialog
  );
  protected readonly notFound = computed(() => this.state().notFound);
  protected readonly canEdit = computed(
    () => this.customer()?.canEdit ?? false
  );
  protected readonly canRestore = computed(
    () => this.customer()?.canRestore ?? false
  );
  protected readonly isSoftDeleted = computed(
    () => this.customer()?.isSoftDeleted ?? false
  );
  protected readonly formErrors = computed(() => this.state().formErrors);

  protected readonly formInitialValue = computed<CustomerFormModel>(() => ({
    name: this.customer()?.name ?? '',
    isActive: this.customer()?.isActive ?? true,
    comment: '',
    defaultDistributorDiscountPct:
      this.customer()?.defaultDistributorDiscountPct ?? 0,
  }));

  constructor() {
    this.loadCustomer();
    this.setupFocusOnError();
  }

  protected onSubmit(payload: CustomerFormModel): void {
    if (!this.customer() || this.saving()) {
      return;
    }

    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      this.message.error('Nazwa kontrahenta nie może być pusta.');
      return;
    }

    if (!CUSTOMER_NAME_PATTERN.test(trimmedName)) {
      this.message.error('Nazwa kontrahenta zawiera niedozwolone znaki.');
      return;
    }

    const currentIsActive = this.customer()!.isActive;
    const shouldUpdateName = trimmedName !== this.customer()!.name;
    const shouldUpdateIsActive = payload.isActive !== currentIsActive;
    const currentDefaultDiscount =
      this.customer()?.defaultDistributorDiscountPct ?? 0;
    const shouldUpdateDefaultDiscount =
      Number(payload.defaultDistributorDiscountPct) !==
      Number(currentDefaultDiscount);

    if (
      !shouldUpdateName &&
      !shouldUpdateIsActive &&
      !shouldUpdateDefaultDiscount
    ) {
      this.message.info('Brak zmian do zapisania.');
      return;
    }

    const command: UpdateCustomerCommand = {
      ...(shouldUpdateName ? { name: trimmedName } : {}),
      ...(shouldUpdateIsActive ? { isActive: payload.isActive } : {}),
      ...(shouldUpdateDefaultDiscount
        ? {
            defaultDistributorDiscountPct:
              payload.defaultDistributorDiscountPct,
          }
        : {}),
    };
    this.patchState({ saving: true, error: null, formErrors: null });

    this.service
      .update(this.customer()!.id, command)
      .pipe(finalize(() => this.patchState({ saving: false })))
      .subscribe({
        next: (response) => {
          this.handleSuccess(
            response,
            'Dane kontrahenta zostały zaktualizowane.',
            { redirectToList: true }
          );
        },
        error: (err) => {
          this.handleMutationError(
            err,
            'Aktualizacja kontrahenta nie powiodła się.',
            'update'
          );
        },
      });
  }

  protected onRestore(): void {
    if (!this.customer() || !this.canRestore() || this.restoreInProgress()) {
      return;
    }

    const command: UpdateCustomerCommand = { isActive: true, deletedAt: null };

    this.patchState({ restoreInProgress: true, error: null });

    this.service
      .update(this.customer()!.id, command)
      .pipe(finalize(() => this.patchState({ restoreInProgress: false })))
      .subscribe({
        next: (response) => {
          this.handleSuccess(response, 'Kontrahent został przywrócony.');
        },
        error: (err) => {
          this.handleMutationError(
            err,
            'Nie udało się przywrócić kontrahenta.',
            'restore'
          );
        },
      });
  }

  protected onSoftDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.patchState({ showDeleteDialog: true });
  }

  protected onConfirmDelete(): void {
    if (!this.customer() || this.deleting()) {
      return;
    }

    this.patchState({ deleting: true });

    this.service
      .softDelete(this.customer()!.id)
      .pipe(
        finalize(() =>
          this.patchState({ deleting: false, showDeleteDialog: false })
        )
      )
      .subscribe({
        next: (response) => {
          this.handleSuccess(
            response,
            'Kontrahent został oznaczony jako usunięty.',
            {
              redirectToList: true,
            }
          );
        },
        error: (err) => {
          this.handleMutationError(
            err,
            'Nie udało się usunąć kontrahenta.',
            'delete'
          );
        },
      });
  }

  protected onCancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.patchState({ showDeleteDialog: false });
  }

  protected onBack(): void {
    this.router.navigate(['/customers']);
  }

  private loadCustomer(): void {
    const customerId = this.route.snapshot.paramMap.get('id');

    if (!customerId) {
      this.patchState({
        loading: false,
        error: {
          code: 'CUSTOMERS_DETAIL_INVALID_ID',
          message: 'Nieprawidłowy identyfikator kontrahenta.',
        },
        notFound: true,
      });
      return;
    }

    this.patchState({ loading: true, error: null, notFound: false });

    this.service
      .getById(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          const vm = mapToViewModel(dto, { roles: this.currentRoles() });
          this.patchState({ customer: vm, loading: false, formErrors: null });
        },
        error: (err) => {
          const apiError = this.mapApiError(err);
          this.patchState({
            loading: false,
            error: apiError,
            notFound: apiError.code === 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
          });
        },
      });
  }

  private patchState(patch: Partial<PageState>): void {
    this.state.update((prev) => ({ ...prev, ...patch }));
  }

  private handleSuccess(
    response: any,
    message: string,
    options?: { redirectToList?: boolean }
  ): void {
    const vm = mapToViewModel(response, { roles: this.currentRoles() });
    this.patchState({ customer: vm, error: null, formErrors: null });
    this.message.success(message);
    if (options?.redirectToList) {
      this.redirectToList();
    }
  }

  private redirectToList(): void {
    void this.router.navigate(['/customers']);
  }

  private handleMutationError(
    error: unknown,
    fallbackMessage: string,
    context: 'update' | 'restore' | 'delete'
  ): void {
    if (context === 'update') {
      const validation = this.mapUpdateValidationError(error);
      if (validation) {
        this.patchState({ formErrors: validation });
        if (validation.generalError) {
          this.message.error(validation.generalError);
        }
        return;
      }
    }

    const apiError = this.mapApiError(error);

    if (
      apiError.code === 'CUSTOMERS_UPDATE_FORBIDDEN' ||
      apiError.code === 'CUSTOMERS_DELETE_FORBIDDEN'
    ) {
      this.message.error('Brak uprawnień do wykonania akcji.');
      this.refreshRoles();
      return;
    }

    if (
      apiError.code === 'CUSTOMERS_UPDATE_NOT_FOUND' ||
      apiError.code === 'CUSTOMERS_DELETE_NOT_FOUND'
    ) {
      this.message.error('Kontrahent nie został znaleziony.');
      this.patchState({ notFound: true });
      return;
    }

    if (apiError.code === 'CUSTOMERS_NAME_TAKEN') {
      this.message.error('Nazwa kontrahenta już istnieje.');
      return;
    }

    if (apiError.code === 'CUSTOMERS_UPDATE_INVALID_STATUS') {
      this.message.error('Nie można zaktualizować statusu kontrahenta.');
      this.loadCustomer();
      return;
    }

    if (apiError.message) {
      this.message.error(apiError.message);
      return;
    }

    this.message.error(fallbackMessage);
  }

  private mapUpdateValidationError(error: any): ServerValidationErrors | null {
    if (!error) {
      return null;
    }

    const { status, error: apiError } = error;

    if (status !== 400 || !apiError) {
      return null;
    }

    if (apiError.code === 'CUSTOMERS_NAME_TAKEN') {
      return { fieldErrors: { name: 'Nazwa kontrahenta już istnieje.' } };
    }

    if (apiError.code === 'CUSTOMERS_UPDATE_VALIDATION') {
      const fieldErrors: NonNullable<
        ServerValidationErrors['fieldErrors']
      > = {};
      const details: string[] = Array.isArray(apiError.details)
        ? apiError.details
        : [];

      details.forEach((detail: string) => {
        const normalized = detail.toLowerCase();
        if (normalized.includes('name')) {
          fieldErrors['name'] = detail;
        }
        if (normalized.includes('active')) {
          fieldErrors['isActive'] = detail;
        }
        if (normalized.includes('defaultdistributordiscountpct')) {
          fieldErrors['defaultDistributorDiscountPct'] = detail;
        }
      });

      return {
        fieldErrors,
        generalError: details.length
          ? details.join(' ')
          : 'Wystąpił błąd walidacji.',
      };
    }

    if (apiError.message) {
      return { generalError: apiError.message };
    }

    return null;
  }

  private mapApiError(error: any): ApiError {
    if (!error) {
      return { code: 'UNKNOWN', message: 'Wystąpił nieoczekiwany błąd.' };
    }

    if (typeof error === 'string') {
      return { code: 'UNKNOWN', message: error };
    }

    if (error instanceof Error) {
      return { code: 'UNKNOWN', message: error.message };
    }

    const { status, error: apiError } = error;

    if (status === 404) {
      return {
        code: apiError?.code ?? 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
        message: apiError?.message ?? 'Kontrahent nie został znaleziony.',
      };
    }

    if (status === 403) {
      return {
        code: apiError?.code ?? 'CUSTOMERS_UPDATE_FORBIDDEN',
        message: apiError?.message ?? 'Brak uprawnień do tej operacji.',
      };
    }

    if (status === 400 && apiError?.code) {
      return {
        code: apiError.code,
        message: apiError.message ?? 'Wystąpił błąd walidacji.',
      };
    }

    if (status === 500) {
      return {
        code: apiError?.code ?? 'CUSTOMERS_SERVER_ERROR',
        message:
          apiError?.message ?? 'Wystąpił błąd serwera. Spróbuj ponownie.',
      };
    }

    return {
      code: apiError?.code ?? 'UNKNOWN',
      message: apiError?.message ?? 'Wystąpił błąd. Spróbuj ponownie.',
    };
  }

  private refreshRoles(): void {
    const user = this.authSession.user();
    if (!user) {
      return;
    }

    this.patchState({
      customer: this.customer()
        ? {
            ...this.customer()!,
            canEdit: this.hasAnyRole(user.roles),
            canRestore:
              this.hasAnyRole(user.roles) && this.customer()!.isSoftDeleted,
          }
        : null,
    });
  }

  private currentRoles(): AppRole[] {
    const user = this.authSession.user();
    return user?.roles ?? ['viewer'];
  }

  private hasAnyRole(roles: AppRole[]): boolean {
    return roles.includes('owner') || roles.includes('editor');
  }

  private setupFocusOnError(): void {
    effect(() => {
      const currentError = this.error()?.message;
      if (!currentError) {
        return;
      }
      requestAnimationFrame(() => {
        const alertElement = document.querySelector(
          '.customer-detail__error-alert'
        ) as HTMLElement | null;
        alertElement?.focus();
      });
    });
  }
}
