import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { NzModalService } from 'ng-zorro-antd/modal';
import { firstValueFrom } from 'rxjs';

import { OrdersNewStore } from './orders-new.store';

export const ordersNewCanDeactivateGuard: CanDeactivateFn<
  unknown
> = async () => {
  const store = inject(OrdersNewStore);
  const modal = inject(NzModalService);

  if (!store.dirty()) {
    return true;
  }

  const ref = modal.confirm({
    nzTitle: 'Masz niezapisane zmiany',
    nzContent:
      'Czy na pewno chcesz opuścić stronę? Wprowadzone dane zostaną utracone.',
    nzOkText: 'Opuść',
    nzCancelText: 'Pozostań',
    nzOkDanger: true,
  });

  const result = await firstValueFrom(ref.afterClose);
  return result === 'ok';
};
