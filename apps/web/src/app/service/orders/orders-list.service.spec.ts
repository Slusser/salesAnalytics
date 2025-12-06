import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
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
import { BehaviorSubject, of } from 'rxjs';

import type {
  ListOrdersResponse,
  OrderListItemDto,
} from '@shared/dtos/orders.dto';
import type { AuthenticatedUserDto } from '@shared/dtos/user-roles.dto';

import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';

import { AuthSessionService } from '../auth/auth-session.service';
import { CustomersService } from '../customers/customers.service';
import {
  ORDERS_DEFAULT_LIMIT,
  ORDERS_DEFAULT_PAGE,
} from './orders-list.types';
import { OrdersListService } from './orders-list.service';

type RouterStub = Pick<Router, 'navigate' | 'navigateByUrl'>;

describe('OrdersListService', () => {
  let httpMock: HttpTestingController;
  let navigateMock: Mock<RouterStub['navigate']>;
  let navigateByUrlMock: Mock<RouterStub['navigateByUrl']>;

  let messageService: {
    success: Mock;
    warning: Mock;
    error: Mock;
  };
  let notificationService: {
    error: Mock;
  };
  let customersService: {
    get: Mock;
    getById: Mock;
  };

  let queryParamMap$: BehaviorSubject<ParamMap>;
  let activatedRouteStub: ActivatedRoute;
  let sessionUserSignal: WritableSignal<AuthenticatedUserDto | null>;

  const buildOrderDto = (
    overrides: Partial<OrderListItemDto> = {}
  ): OrderListItemDto => ({
    id: 'order-1',
    orderNo: 'ORD-001',
    customerId: 'customer-1',
    orderDate: '2024-01-01',
    itemName: 'Produkt',
    quantity: 5,
    producerDiscountPct: 0,
    distributorDiscountPct: 0,
    vatRatePct: 23,
    totalNetPln: 1000,
    totalGrossPln: 1230,
    createdBy: 'user-1',
    createdAt: '2024-01-02T10:00:00.000Z',
    updatedAt: '2024-01-02T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  });

  const buildListResponse = (
    dtoOverrides: Partial<OrderListItemDto> = {}
  ): ListOrdersResponse => ({
    items: [buildOrderDto(dtoOverrides)],
    total: 1,
    page: 1,
    limit: 25,
  });

  const updateQueryParams = (params: Record<string, unknown>) => {
    const map = convertToParamMap(params);
    (activatedRouteStub as unknown as { snapshot: { queryParamMap: ParamMap } })
      .snapshot.queryParamMap = map;
    queryParamMap$.next(map);
  };

  const expectOrdersRequest = () =>
    httpMock.expectOne((request) => request.url === '/api/orders');

  const expectNoOrdersRequest = () =>
    httpMock.expectNone((request) => request.url === '/api/orders');

  const createService = (responseOverrides: Partial<OrderListItemDto> = {}) => {
    const service = TestBed.inject(OrdersListService);
    const initialRequests = httpMock.match(
      (request) => request.url === '/api/orders'
    );
    expect(initialRequests.length).toBeGreaterThan(0);
    initialRequests.forEach((request) => {
      expect(request.request.method).toBe('GET');
      request.flush(buildListResponse(responseOverrides));
    });
    (service as unknown as { loading: WritableSignal<boolean> }).loading.set(
      false
    );
    return service;
  };

  const setUser = (roles: AuthenticatedUserDto['roles']) => {
    sessionUserSignal.set({
      id: 'user-1',
      displayName: 'Jan Tester',
      email: 'jan@example.com',
      roles,
    });
  };

  beforeEach(() => {
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    activatedRouteStub = {
      snapshot: { queryParamMap: queryParamMap$.value },
      queryParamMap: queryParamMap$.asObservable(),
    } as unknown as ActivatedRoute;

    navigateMock = vi.fn();
    navigateByUrlMock = vi.fn();

    messageService = {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    notificationService = {
      error: vi.fn(),
    };
    customersService = {
      get: vi.fn(() => of([])),
      getById: vi.fn(() => of(null)),
    };

    sessionUserSignal = signal<AuthenticatedUserDto | null>(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrdersListService,
        {
          provide: Router,
          useValue: {
            navigate: navigateMock,
            navigateByUrl: navigateByUrlMock,
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
          provide: NzNotificationService,
          useValue: notificationService,
        },
        {
          provide: CustomersService,
          useValue: customersService,
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

  it('aktualizuje uprawnienia po zmianie ról użytkownika', () => {
    const service = createService();

    expect(service.permissions()).toEqual({
      canMutate: false,
      canIncludeDeleted: false,
    });

    setUser(['viewer']);
    expect(service.permissions()).toEqual({
      canMutate: false,
      canIncludeDeleted: false,
    });

    setUser(['owner']);
    expect(service.permissions()).toEqual({
      canMutate: true,
      canIncludeDeleted: true,
    });

    setUser(['editor']);
    expect(service.permissions()).toEqual({
      canMutate: true,
      canIncludeDeleted: true,
    });
  });

  it('normalizuje parametry wyszukiwania i restartuje numer strony', () => {
    const service = createService();
    navigateMock.mockClear();

    service.setParams({ orderNo: '  ZAM/XYZ  ', page: 3 }, { resetPage: true });

    const params = service.params();
    expect(params.orderNo).toBe('zam/xyz');
    expect(params.page).toBe(ORDERS_DEFAULT_PAGE);
    expect(params.limit).toBe(ORDERS_DEFAULT_LIMIT);

    expect(navigateMock).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        relativeTo: activatedRouteStub,
        queryParamsHandling: 'merge',
        queryParams: expect.objectContaining({
          orderNo: 'zam/xyz',
          page: ORDERS_DEFAULT_PAGE,
          limit: ORDERS_DEFAULT_LIMIT,
          sort: 'orderDate:desc',
        }),
      })
    );

    const refetch = expectOrdersRequest();
    expect(refetch.request.method).toBe('GET');
    expect(refetch.request.params.get('orderNo')).toBe('zam/xyz');
    expect(refetch.request.params.get('page')).toBe(
      String(ORDERS_DEFAULT_PAGE)
    );
    refetch.flush(buildListResponse());
  });

  it('nie wywołuje ponownego pobrania, gdy parametry nie ulegają zmianie', () => {
    const service = createService();
    navigateMock.mockClear();

    service.setParams({}, {});

    expect(navigateMock).not.toHaveBeenCalled();
    expectNoOrdersRequest();
  });

  it('odrzuca próbę włączenia includeDeleted bez uprawnień', () => {
    const service = createService();
    navigateMock.mockClear();
    messageService.warning.mockClear();

    service.toggleIncludeDeleted(true);

    expect(messageService.warning).toHaveBeenCalledWith(
      'Nie masz uprawnień do przeglądania usuniętych zamówień.'
    );
    expect(service.params().includeDeleted).toBeUndefined();
    expect(navigateMock).not.toHaveBeenCalled();
    expectNoOrdersRequest();
  });

  it('umożliwia włączenie includeDeleted dla roli z uprawnieniami', () => {
    setUser(['owner']);
    const service = createService();
    navigateMock.mockClear();
    messageService.warning.mockClear();

    service.toggleIncludeDeleted(true);

    expect(service.params().includeDeleted).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const request = expectOrdersRequest();
    expect(request.request.params.get('includeDeleted')).toBe('true');
    request.flush(buildListResponse());
    expect(messageService.warning).not.toHaveBeenCalled();
  });

  it('przywraca filtr includeDeleted po otrzymaniu błędu 403', () => {
    setUser(['owner']);
    const service = createService();
    navigateMock.mockClear();
    messageService.warning.mockClear();

    service.setParams({ includeDeleted: true });

    const forbiddenRequest = expectOrdersRequest();
    forbiddenRequest.flush(
      { message: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(messageService.warning).toHaveBeenCalledWith(
      'Brak uprawnień do podglądu usuniętych zamówień. Przywrócono filtr domyślny.'
    );

    const fallbackRequest = expectOrdersRequest();
    fallbackRequest.flush(buildListResponse());

    expect(service.params().includeDeleted).toBeUndefined();
    expect(notificationService.error).not.toHaveBeenCalled();
  });

  it('pozwala oznaczyć zamówienie jako usunięte i odświeża listę po sukcesie', () => {
    setUser(['owner']);
    const service = createService();

    const order = service.data()?.items[0];
    expect(order).toBeDefined();
    if (!order) {
      throw new Error('Oczekiwano zamówienia testowego.');
    }

    messageService.success.mockClear();

    service.askSoftDelete(order);
    expect(service.confirmDialogOpen()).toBe(true);
    expect(service.confirmDialogLoading()).toBe(false);

    service.confirmDialogConfirm();

    const deleteRequest = httpMock.expectOne('/api/orders/order-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({});

    const refetch = expectOrdersRequest();
    refetch.flush(buildListResponse());

    expect(messageService.success).toHaveBeenCalledWith(
      'Zamówienie "ORD-001" zostało oznaczone jako usunięte.'
    );
    expect(service.confirmDialogOpen()).toBe(false);
  });
});

