Monorepo:
Nx - zarządzanie plikami, wspólne modele między Angular i NestJS

Frontend:
- Angular 20 pozwala na tworzenie szybkich, wydajnych stron i aplikacji, dobra znajmość przez zespół
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- NgZorro zapewnia bibliotekę dostępnych komponentów Angular, na których oprzemy UI

Backend:
- NestJS jako backend do obsługi supabase i źródło api
- Supabase jako narzędzie do autentykacji, endpointy w NestJS
- Supabase jako baza danych PostgreSQL obsługwana z poziomu NestJS
- Supabase jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Supabase posiada wbudowaną autentykację użytkowników
- Swagger do dokumentacji API

Testy:
- Vitest 3 jako runner testów jednostkowych zarówno dla Angulara (z `@analogjs/vitest-angular`), jak i NestJS.
- Minimalne pokrycie kodu logiki biznesowej (services, mappers, guards, validators, utilities) na poziomie 70%.
- Backend: priorytet testowania dla `OrdersService`, `CustomersService`, `AuthService`, warstwy mapperów domenowych, guardów (`JwtAuthGuard`, `RolesGuard`), pipes walidacyjnych i pomocniczych utili.
- Frontend: pokrycie usług stanu (`OrdersListService`, `AuthSessionService`, `CustomersService`), komponentów formularzy, logiki prezentacyjnej, pipes i niestandardowych walidatorów.
- Kluczowe kalkulacje (np. `totalGrossPln = totalNetPln * (1 + vatRatePct/100)`) muszą być weryfikowane z tolerancją 0,01.
- Playwright jako zunifikowany projekt `apps/e2e` (targets: `api`, `chromium`, `flows`) obejmujący testy API, UI i pełne przepływy biznesowe.

CI/CD i Hosting:
- Github Actions do tworzenia pipeline’ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker