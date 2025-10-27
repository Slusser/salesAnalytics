import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzCardModule } from 'ng-zorro-antd/card';

import type {
  CustomerFormModel,
  ServerValidationErrors,
} from '../../../shared/components/customers/customer-form/customer-form.types';
import type { CreateCustomerRequest } from '../../../service/customers/customers-create.service';
import { CustomersCreateService } from '../../../service/customers/customers-create.service';
import { CustomerFormComponent } from '../../../shared/components/customers/customer-form/customer-form.component';

@Component({
  selector: 'app-customers-new-page',
  standalone: true,
  imports: [
    CommonModule,
    NzTypographyModule,
    NzCardModule,
    CustomerFormComponent,
  ],
  templateUrl: './customers-new.page.html',
  styleUrl: './customers-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersNewPageComponent {
  private readonly service = inject(CustomersCreateService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  protected readonly submitting = signal(false);
  protected readonly serverErrors = signal<ServerValidationErrors | null>(null);
  protected readonly initialFormValue = signal<CustomerFormModel>({
    name: '',
    isActive: true,
    comment: '',
  });

  protected readonly hasServerErrors = computed(() => !!this.serverErrors());

  constructor() {
    effect(() => {
      if (!this.serverErrors()) {
        return;
      }

      if (this.serverErrors()?.fieldErrors?.name) {
        requestAnimationFrame(() => {
          const nameInput = document.getElementById('customer-name');
          nameInput?.focus();
        });
      }
    });
  }

  protected onSubmit(model: CustomerFormModel): void {
    if (this.submitting()) {
      return;
    }

    const payload: CreateCustomerRequest = {
      name: model.name,
      isActive: model.isActive,
    };

    this.submitting.set(true);
    this.serverErrors.set(null);

    this.service.createCustomer(payload).subscribe({
      next: (customer) => {
        this.submitting.set(false);
        this.message.success(`Kontrahent "${customer.name}" został utworzony.`);
        this.navigateToList();
      },
      error: (error) => {
        this.submitting.set(false);
        const mapped = this.mapErrorToForm(error);
        this.serverErrors.set(mapped);
        if (!mapped?.fieldErrors?.name && mapped?.generalError) {
          this.message.error(mapped.generalError);
        }
      },
    });
  }

  protected onCancel(): void {
    if (this.submitting()) {
      return;
    }

    this.navigateToList();
  }

  private mapErrorToForm(error: any): ServerValidationErrors {
    if (!error) {
      return {
        generalError: 'Nie udało się utworzyć kontrahenta. Spróbuj ponownie.',
      };
    }

    const { status, error: apiError } = error;

    if (status === 400 && apiError?.code === 'CUSTOMER_DUPLICATE_NAME') {
      return { fieldErrors: { name: 'Nazwa kontrahenta już istnieje.' } };
    }

    if (status === 400 && apiError?.code === 'CUSTOMER_VALIDATION_ERROR') {
      const fieldErrors: Record<string, string> = {};
      const details: string[] = apiError?.details ?? [];
      details.forEach((detail: string) => {
        if (detail.toLowerCase().includes('name')) {
          fieldErrors['name'] = detail;
        }
      });

      return {
        fieldErrors,
        generalError: details.length
          ? details.join(' ')
          : 'Wystąpił błąd walidacji.',
      };
    }

    if (status === 403) {
      this.router.navigate(['/customers']);
      this.message.error('Brak uprawnień do tworzenia kontrahentów.');
      return {};
    }

    if (status === 401) {
      this.message.error('Sesja wygasła. Zaloguj się ponownie.');
      this.router.navigate(['/auth/login']);
      return {};
    }

    return {
      generalError: 'Nie udało się utworzyć kontrahenta. Spróbuj ponownie.',
    };
  }

  private navigateToList(): void {
    this.router.navigate(['/customers'], { state: { refresh: true } });
  }
}
