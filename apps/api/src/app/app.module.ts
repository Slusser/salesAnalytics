import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { SupabaseMiddleware } from '@middleware'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CustomersModule } from '../customers/customers.module'
import { SecurityModule } from '../security/security.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SecurityModule, AuthModule, CustomersModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SupabaseMiddleware).forRoutes('*')
  }
}
