# Struktura backendu (ASCII)

```
@main.ts (apps/api/src/main.ts)
+-- bootstrap()
    |-- NestFactory.create(AppModule)
    |-- konfiguracja Swagger (DocumentBuilder, SwaggerModule.setup)
    |-- app.setGlobalPrefix('api')
    |-- app.listen(PORT) z logowaniem URL
+-- AppModule (apps/api/src/app/app.module.ts)
    |-- imports
    |   +-- SecurityModule (apps/api/src/security/security.module.ts) [@Global]
    |   |   +-- providers
    |   |   |   +-- SupabaseFactory (apps/api/src/supabase/supabase.factory.ts) -> tworzy SupabaseClient z env
    |   |   |   +-- RequestContextService -> korzysta z SupabaseFactory do ustalenia biezacego uzytkownika i rol
    |   |   |   +-- APP_GUARD: JwtAuthGuard -> wymaga RequestContextService i Reflector, sprawdza token Bearer i ustawia request.currentUser
    |   |   |   +-- APP_GUARD: RolesGuard -> wymaga Reflector, waliduje dekorator @Roles
    |   |   +-- exports: RequestContextService, SupabaseFactory
    |   +-- AuthModule (apps/api/src/auth/auth.module.ts)
    |   |   +-- controller: AuthController (/auth) -> korzysta z AuthService
    |   |   +-- providers: AuthService -> korzysta z SupabaseFactory oraz AuthMapper
    |   |                      AuthMapper -> mapuje Supabase Session na DTO
    |   +-- CustomersModule (apps/api/src/customers/customers.module.ts)
    |   |   +-- controller: CustomersController (/customers) -> korzysta z CustomersService oraz guardow z SecurityModule
    |   |   +-- providers: CustomersService -> opiera sie na CustomersRepository oraz CustomerMapper
    |   |   |               CustomersRepository -> korzysta z supabaseClient (apps/db/supabase.client.ts) oraz CustomerMapper
    |   |   +-- exports: CustomersService
    |   +-- OrdersModule (apps/api/src/app/orders/orders.module.ts)
    |       +-- controller: OrdersController (/orders) -> korzysta z OrdersService, JwtAuthGuard, RolesGuard, dekoratora @CurrentUser
    |       +-- providers: OrdersService -> opiera sie na OrdersRepository
    |       |               OrdersRepository -> korzysta z supabaseClient oraz OrderMapper
    |       +-- DTO i mapery: ./dto/*, ./order.mapper.ts
    |-- controllers
    |   +-- AppController -> wykorzystuje AppService.getData()
    |-- providers
    |   +-- AppService -> zwraca statyczne dane powitalne
    |-- configure(consumer: MiddlewareConsumer)
        +-- consumer.apply(SupabaseMiddleware).forRoutes('*')
            +-- SupabaseMiddleware (apps/middleware/index.ts) -> wstrzykuje supabaseClient do request.supabase

Warstwa wspolna
+-- supabaseClient (apps/db/supabase.client.ts) -> klient Supabase korzystajacy z createSupabaseClient
+-- DTO (apps/shared/dtos) -> kontrakty wspoldzielone miedzy frontendem i backendem
+-- Dekoratory i typy (apps/api/src/security/*.decorator.ts, types.ts) -> @Public, @Roles, @CurrentUser oraz CurrentUserRequest
```

