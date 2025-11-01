import type { CanDeactivateFn } from '@angular/router';

export interface OrderDetailCanDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

export const orderDetailCanDeactivateGuard: CanDeactivateFn<OrderDetailCanDeactivate> = (
  component,
) => {
    if (!component || typeof component.canDeactivate !== 'function') {
      return true;
    }

    return component.canDeactivate();
  };

