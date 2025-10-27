import type { CustomerDetailResponse } from 'apps/shared/dtos/customers.dto';
import type { AppRole } from 'apps/shared/dtos/user-roles.dto';

export interface CustomerViewModel {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isSoftDeleted: boolean;
  canEdit: boolean;
  canRestore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
}

export interface CustomerMapperContext {
  roles: AppRole[];
}

export function mapToViewModel(
  customer: CustomerDetailResponse,
  context: CustomerMapperContext
): CustomerViewModel {
  const roles = context.roles ?? [];
  const isSoftDeleted = customer.deletedAt !== null;
  const canEdit = roles.includes('owner') || roles.includes('editor');

  return {
    id: customer.id,
    name: customer.name,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    deletedAt: customer.deletedAt,
    isSoftDeleted,
    canEdit,
    canRestore: canEdit && isSoftDeleted,
  };
}
