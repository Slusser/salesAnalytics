import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { SupabaseMiddleware } from '@middleware'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CustomersModule } from '../customers/customers.module'
import { SecurityModule } from '../security/security.module'

@Module({
  imports: [CustomersModule, SecurityModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SupabaseMiddleware).forRoutes('*')
  }
}
