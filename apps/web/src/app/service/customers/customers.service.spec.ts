import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  type ParamMap,
  Router,
} from '@angular/router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { BehaviorSubject } from 'rxjs';

import type {
  CustomerDetailResponse,
  CustomerDto,
  ListCustomersResponse,
} from '@shared/dtos/customers.dto';
import type { AuthenticatedUserDto } from '@shared/dtos/user-roles.dto';

import { NzMessageService } from 'ng-zorro-antd/message';

import { AuthSessionService } from '../auth/auth-session.service';
import { CustomersService } from './customers.service';
import {
  CUSTOMERS_DEFAULT_LIMIT,
  CUSTOMERS_DEFAULT_PAGE,
  CUSTOMERS_MAX_SEARCH_LENGTH,
  type CustomerRowVm,
} from './customers.types';

type RouterStub = Pick<Router, 'navigate'>;

describe('CustomersService', () => {
  let httpMock: HttpTestingController;
  let navigateMock: Mock<RouterStub['navigate']>;

  let messageService: {
    success: Mock;
    error: Mock;
  };

  let queryParamMap$: BehaviorSubject<ParamMap>;
  let activatedRouteStub: ActivatedRoute;
  let sessionUserSignal: WritableSignal<AuthenticatedUserDto | null>;

  const flushSignals = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  const buildCustomerDto = (
    overrides: Partial<CustomerDto> = {}
  ): CustomerDto => ({
    id: 'customer-1',
    name: 'ACME Sp. z o.o.',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  });

  const buildListResponse = (
    items: CustomerDto[] = [buildCustomerDto()]
  ): ListCustomersResponse => ({
    items,
    total: items.length,
    page: 1,
    limit: 25,
  });

  const buildDetailResponse = (
    overrides: Partial<CustomerDetailResponse> = {}
  ): CustomerDetailResponse => ({
    ...buildCustomerDto(),
    ...overrides,
  });

  const expectCustomersRequest = () =>
    httpMock.expectOne((request) => request.url === '/api/customers');

  const expectNoCustomersRequest = () =>
    httpMock.expectNone((request) => request.url === '/api/customers');

  const updateQueryParams = (params: Record<string, unknown>) => {
    const map = convertToParamMap(params);
    (
      activatedRouteStub as unknown as {
        snapshot: { queryParamMap: ParamMap };
      }
    ).snapshot.queryParamMap = map;
    queryParamMap$.next(map);
  };

  const setUser = (roles: AuthenticatedUserDto['roles']) => {
    sessionUserSignal.set({
      id: 'user-1',
      displayName: 'Jan Tester',
      email: 'jan@example.com',
      roles,
    });
  };

  const createService = () => {
    const service = TestBed.inject(CustomersService);
    const request = expectCustomersRequest();
    expect(request.request.method).toBe('GET');
    request.flush(buildListResponse());
    return service;
  };

  const createServiceAsync = async () => {
    const service = createService();
    await flushSignals();
    return service;
  };

  beforeEach(() => {
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    activatedRouteStub = {
      snapshot: { queryParamMap: queryParamMap$.value },
      queryParamMap: queryParamMap$.asObservable(),
    } as unknown as ActivatedRoute;

    navigateMock = vi.fn();

    messageService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    sessionUserSignal = signal<AuthenticatedUserDto | null>(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CustomersService,
        {
          provide: Router,
          useValue: {
            navigate: navigateMock,
          } satisfies RouterStub,
        },
        {
          provide: ActivatedRoute,
          useValue: activatedRouteStub,
        },
        {
          provide: NzMessageService,
          useValue: messageService,
        },
        {
          provide: AuthSessionService,
          useValue: {
            user: sessionUserSignal,
          },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    updateQueryParams({});
  });

  it('aktualizuje role i wynik canMutate na podstawie danych sesji', async () => {
    const service = await createServiceAsync();

    expect(service.roles()).toEqual(['viewer']);
    expect(service.canMutate()).toBe(false);

    setUser(['owner']);
    await flushSignals();
    expect(service.roles()).toEqual(['owner']);
    expect(service.canMutate()).toBe(true);

    setUser(['editor']);
    await flushSignals();
    expect(service.roles()).toEqual(['editor']);
    expect(service.canMutate()).toBe(true);

    setUser(['viewer']);
    await flushSignals();
    expect(service.roles()).toEqual(['viewer']);
    expect(service.canMutate()).toBe(false);
  });

  it('normalizuje parametry wyszukiwania i resetuje numer strony', () => {
    const service = createService();
    navigateMock.mockClear();

    const longSearch =
      '   ' +
      'x'.repeat(CUSTOMERS_MAX_SEARCH_LENGTH + 10) +
      '   dodatkowe znaki   ';
    const expectedSearch = 'x'.repeat(CUSTOMERS_MAX_SEARCH_LENGTH);

    service.setParams(
      { search: longSearch, limit: 999, page: 5 },
      { resetPage: true }
    );

    const params = service.params();
    expect(params.search).toBe(expectedSearch);
    expect(params.page).toBe(CUSTOMERS_DEFAULT_PAGE);
    expect(params.limit).toBe(CUSTOMERS_DEFAULT_LIMIT);

    expect(navigateMock).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        relativeTo: activatedRouteStub,
        queryParamsHandling: 'merge',
        queryParams: expect.objectContaining({
          search: expectedSearch,
          page: CUSTOMERS_DEFAULT_PAGE,
          limit: CUSTOMERS_DEFAULT_LIMIT,
        }),
      })
    );

    const refetch = expectCustomersRequest();
    expect(refetch.request.method).toBe('GET');
    expect(refetch.request.params.get('search')).toBe(expectedSearch);
    expect(refetch.request.params.get('limit')).toBe(
      String(CUSTOMERS_DEFAULT_LIMIT)
    );
    refetch.flush(buildListResponse());
  });

  it('nie ustawia includeInactive, gdy użytkownik nie ma uprawnień mutacji', () => {
    const service = createService();
    navigateMock.mockClear();

    service.setParams({ includeInactive: true });

    expect(service.params().includeInactive).toBeUndefined();
    expect(navigateMock).not.toHaveBeenCalled();
    expectNoCustomersRequest();
  });

  it('pozwala włączyć includeInactive dla użytkownika z uprawnieniami', async () => {
    const service = await createServiceAsync();
    setUser(['owner']);
    await flushSignals();
    navigateMock.mockClear();

    service.setParams({ includeInactive: true });

    expect(service.params().includeInactive).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(1);

    const request = expectCustomersRequest();
    expect(request.request.params.get('includeInactive')).toBe('true');
    request.flush(buildListResponse());
  });

  it('wykonuje miękkie usunięcie klienta i odświeża dane po sukcesie', async () => {
    const service = await createServiceAsync();
    setUser(['owner']);
    await flushSignals();

    messageService.success.mockClear();

    const customer: CustomerRowVm = {
      id: 'customer-1',
      name: 'ACME Sp. z o.o.',
      isActive: true,
      deleted: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    service.askSoftDelete(customer);
    expect(service.confirmDialogOpen()).toBe(true);
    expect(service.confirmDialogTitle()).toBe('Usuń kontrahenta');
    expect(service.confirmDialogLoading()).toBe(false);

    service.confirmDialogConfirm();

    const deleteRequest = httpMock.expectOne('/api/customers/customer-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(
      buildDetailResponse({ id: customer.id, name: customer.name })
    );

    const refetch = expectCustomersRequest();
    expect(refetch.request.method).toBe('GET');
    refetch.flush(buildListResponse());

    expect(messageService.success).toHaveBeenCalledWith(
      `Kontrahent "${customer.name}" został oznaczony jako usunięty.`
    );
    expect(service.confirmDialogOpen()).toBe(false);
    expect(service.confirmDialogLoading()).toBe(false);
  });

  it('czyści dialog i raportuje błąd, gdy przywracanie klienta kończy się niepowodzeniem', async () => {
    const service = await createServiceAsync();
    setUser(['owner']);
    await flushSignals();

    messageService.error.mockClear();

    const customer: CustomerRowVm = {
      id: 'customer-1',
      name: 'ACME Sp. z o.o.',
      isActive: false,
      deleted: true,
      deletedAt: '2024-02-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
    };

    service.askRestore(customer);
    expect(service.confirmDialogOpen()).toBe(true);
    expect(service.confirmDialogTitle()).toBe('Przywróć kontrahenta');

    service.confirmDialogConfirm();

    const restoreRequest = httpMock.expectOne('/api/customers/customer-1');
    expect(restoreRequest.request.method).toBe('PUT');
    expect(restoreRequest.request.body).toEqual({
      isActive: true,
      deletedAt: null,
    });
    restoreRequest.flush(
      { message: 'Usługa chwilowo niedostępna' },
      {
        status: 503,
        statusText: 'Service Unavailable',
      }
    );

    expect(messageService.error).toHaveBeenCalledWith(
      expect.stringContaining('503 Service Unavailable')
    );
    expect(service.confirmDialogOpen()).toBe(false);
    expect(service.confirmDialogLoading()).toBe(false);
    expectNoCustomersRequest();
  });

  it('resetuje filtry do wartości domyślnych i pobiera dane ponownie', async () => {
    const service = await createServiceAsync();
    setUser(['owner']);
    await flushSignals();

    service.setParams({ search: ' klient ', includeInactive: true, page: 3 });
    const filteredRequest = expectCustomersRequest();
    filteredRequest.flush(buildListResponse());

    expect(service.params()).toEqual(
      expect.objectContaining({
        search: 'klient',
        includeInactive: true,
        page: 3,
      })
    );

    navigateMock.mockClear();

    service.resetFilters();

    const refetch = expectCustomersRequest();
    expect(refetch.request.params.get('search')).toBeNull();
    expect(refetch.request.params.get('includeInactive')).toBeNull();
    expect(refetch.request.params.get('page')).toBe(
      String(CUSTOMERS_DEFAULT_PAGE)
    );
    refetch.flush(buildListResponse());

    expect(service.params().search).toBeUndefined();
    expect(service.params().includeInactive).toBeUndefined();
    expect(service.params().page).toBe(CUSTOMERS_DEFAULT_PAGE);
    expect(service.params().limit).toBe(CUSTOMERS_DEFAULT_LIMIT);
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });
});


