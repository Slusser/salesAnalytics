import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { RequestContextService } from './request-context.service';
import { SupabaseFactory } from '../supabase/supabase.factory';

@Global()
@Module({
  providers: [
    SupabaseFactory,
    RequestContextService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [RequestContextService, SupabaseFactory],
})
export class SecurityModule {}
