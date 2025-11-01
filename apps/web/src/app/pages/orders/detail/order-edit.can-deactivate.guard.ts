import type { CanDeactivateFn } from '@angular/router';

export interface OrderEditCanDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

export const orderEditCanDeactivateGuard: CanDeactivateFn<OrderEditCanDeactivate> = (
  component,
) => {
  if (!component || typeof component.canDeactivate !== 'function') {
    return true;
  }

  return component.canDeactivate();
};

