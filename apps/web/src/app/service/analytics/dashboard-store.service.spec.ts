import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService } from 'ng-zorro-antd/message';

import { DashboardStoreService } from './dashboard-store.service';
import { AnalyticsDashboardApiService } from './analytics-dashboard-api.service';

type ApiMock = {
  fetchKpi: ReturnType<typeof vi.fn>;
  fetchTrend: ReturnType<typeof vi.fn>;
  fetchDaily: ReturnType<typeof vi.fn>;
};

describe('DashboardStoreService', () => {
  let service: DashboardStoreService;
  let api: ApiMock;
  let queryParamMap$: BehaviorSubject<ParamMap>;
  let notification: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T00:00:00Z'));

    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    const activatedRouteStub = {
      snapshot: { queryParamMap: queryParamMap$.value },
      queryParamMap: queryParamMap$.asObservable(),
    } as ActivatedRoute;

    api = {
      fetchKpi: vi.fn().mockReturnValue(
        of({
          sumNetPln: 0,
          sumGrossPln: 0,
          sumDistributorPln: 0,
          sumCustomerPln: 0,
          sumProfitPln: 0,
          ordersCount: 0,
          avgOrderValue: 0,
          avgMarginPct: 0,
        })
      ),
      fetchTrend: vi.fn().mockReturnValue(of([])),
      fetchDaily: vi.fn().mockReturnValue(of([])),
    };

    notification = {
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DashboardStoreService,
        { provide: AnalyticsDashboardApiService, useValue: api },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NzNotificationService, useValue: notification },
        { provide: NzMessageService, useValue: { error: vi.fn() } },
      ],
    });

    service = TestBed.inject(DashboardStoreService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes filters to current year boundaries', () => {
    expect(service.filters().dateFrom).toBe('2024-01-01');
    expect(service.filters().dateTo).toBe('2024-12-31');
  });

  it('normalizes reversed date range when setting filters', () => {
    service.setFilters({
      dateFrom: '2024-12-31',
      dateTo: '2024-01-01',
    });

    expect(service.filters()).toEqual(
      expect.objectContaining({
        dateFrom: '2024-12-31',
        dateTo: '2024-12-31',
      })
    );
  });

  it('forces KPI and trend reload when requested', async () => {
    api.fetchKpi.mockClear();
    api.fetchTrend.mockClear();

    await service.refreshAll(true);

    expect(api.fetchKpi).toHaveBeenCalledTimes(1);
    expect(api.fetchTrend).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping refreshAll calls', async () => {
    api.fetchKpi.mockClear();
    api.fetchTrend.mockClear();

    const kpiSubject = new Subject<any>();
    api.fetchKpi.mockReturnValue(kpiSubject.asObservable());

    api.fetchTrend.mockReturnValue(of([]));

    const first = service.refreshAll(true);
    await Promise.resolve();

    await service.refreshAll(true);
    expect(api.fetchKpi).toHaveBeenCalledTimes(1);

    kpiSubject.next({
      sumNetPln: 0,
      sumGrossPln: 0,
      sumDistributorPln: 0,
      sumCustomerPln: 0,
      sumProfitPln: 0,
      ordersCount: 0,
      avgOrderValue: 0,
      avgMarginPct: 0,
    });
    kpiSubject.complete();

    await first;
  });
});


