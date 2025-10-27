import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthMapper } from './auth.mapper';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthMapper],
})
export class AuthModule {}
