import { SetMetadata } from '@nestjs/common';

import type { AppRole } from 'apps/shared/dtos/user-roles.dto';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
