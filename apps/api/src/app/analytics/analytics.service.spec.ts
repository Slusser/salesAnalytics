import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';
import type { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import type { SupabaseFactory } from '../../supabase/supabase.factory';
import type { Database } from '@db/database.types';

type AnalyticsRepositoryMock = {
  fetchKpiAggregates: ReturnType<typeof vi.fn>;
  fetchMonthlyTrend: ReturnType<typeof vi.fn>;
};

type SupabaseFactoryMock = {
  create: ReturnType<typeof vi.fn>;
};

const createRequester = (
  roles: UserRoleValue[] = ['viewer' as UserRoleValue],
  overrides: Partial<CustomerMutatorContext> = {}
): CustomerMutatorContext => ({
  actorId: 'user-1',
  actorRoles: roles,
  accessToken: 'token-123',
  ...overrides,
});

const baseQuery = {
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-01-31'),
};

const baseTrendCommand = {
  dateFrom: '2024-01-01',
  dateTo: '2024-03-31',
};

describe('AnalyticsService', () => {
  let repository: AnalyticsRepositoryMock;
  let supabaseFactory: SupabaseFactoryMock;
  let service: AnalyticsService;
  let supabaseClient: SupabaseClient<Database>;

  beforeEach(() => {
    repository = {
      fetchKpiAggregates: vi.fn(),
      fetchMonthlyTrend: vi.fn(),
    };
    supabaseFactory = {
      create: vi.fn(),
    };
    supabaseClient = {} as SupabaseClient<Database>;
    supabaseFactory.create.mockReturnValue(supabaseClient);
    service = new AnalyticsService(
      repository as unknown as AnalyticsRepository,
      supabaseFactory as unknown as SupabaseFactory
    );
  });

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T00:00:00.000Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rzuca ForbiddenException, gdy requester nie jest dostępny', async () => {
    await expect(
      service.getKpiAggregates({
        ...baseQuery,
        customerId: undefined,
        requester: undefined as unknown as CustomerMutatorContext,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.fetchKpiAggregates).not.toHaveBeenCalled();
  });

  it('rzuca ForbiddenException, gdy viewer filtruje po customerId', async () => {
    const requester = createRequester(['viewer' as UserRoleValue]);

    await expect(
      service.getKpiAggregates({
        ...baseQuery,
        customerId: 'customer-123',
        requester,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.fetchKpiAggregates).not.toHaveBeenCalled();
  });

  it('rzuca InternalServerErrorException, gdy brakuje tokenu dostępowego', async () => {
    const requester = createRequester(['owner' as UserRoleValue], {
      accessToken: '',
    });

    await expect(
      service.getKpiAggregates({
        ...baseQuery,
        requester,
      })
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(repository.fetchKpiAggregates).not.toHaveBeenCalled();
  });

  it('zwraca zaokrąglone dane KPI, gdy repozytorium zwróci wyniki', async () => {
    repository.fetchKpiAggregates.mockResolvedValue({
      sumNetPln: 123.456,
      ordersCount: 3,
    });
    const requester = createRequester();

    const result = await service.getKpiAggregates({
      ...baseQuery,
      requester,
    });

    expect(supabaseFactory.create).toHaveBeenCalledWith(requester.accessToken);
    expect(repository.fetchKpiAggregates).toHaveBeenCalledWith(
      supabaseClient,
      expect.objectContaining({
        requester,
      })
    );
    expect(result).toEqual({
      sumNetPln: 123.46,
      ordersCount: 3,
      avgOrderValue: 41.15,
    });
  });

  it('opakowuje błąd repozytorium w InternalServerErrorException', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    repository.fetchKpiAggregates.mockRejectedValue(
      new Error('DB connection failed')
    );
    const requester = createRequester(['owner' as UserRoleValue]);

    await expect(
      service.getKpiAggregates({
        ...baseQuery,
        requester,
      })
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  describe('getTrend', () => {
    it('rzuca ForbiddenException, gdy viewer filtruje po customerId', async () => {
      const requester = createRequester(['viewer' as UserRoleValue]);

      await expect(
        service.getTrend({
          ...baseTrendCommand,
          customerId: 'customer-123',
          requester,
        })
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.fetchMonthlyTrend).not.toHaveBeenCalled();
    });

    it('rzuca BadRequestException dla zakresu powyżej 24 miesięcy', async () => {
      const requester = createRequester(['owner' as UserRoleValue]);

      await expect(
        service.getTrend({
          dateFrom: '2022-01-01',
          dateTo: '2024-12-31',
          requester,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('zwraca trend, gdy repozytorium zwróci dane', async () => {
      repository.fetchMonthlyTrend.mockResolvedValue([
        { period: '2024-01', sumNetPln: 100 },
      ]);
      const requester = createRequester(['editor' as UserRoleValue]);

      const result = await service.getTrend({
        ...baseTrendCommand,
        customerId: undefined,
        requester,
      });

      expect(repository.fetchMonthlyTrend).toHaveBeenCalledWith(
        supabaseClient,
        expect.objectContaining({
          customerId: undefined,
        })
      );
      expect(result).toEqual([{ period: '2024-01', sumNetPln: 100 }]);
    });

    it('dopisuje wartości null dla miesięcy w przyszłości', async () => {
      repository.fetchMonthlyTrend.mockResolvedValue([
        { period: '2024-05', sumNetPln: 100 },
        { period: '2024-06', sumNetPln: 80 },
      ]);
      const requester = createRequester(['owner' as UserRoleValue]);

      const result = await service.getTrend({
        dateFrom: '2024-05-01',
        dateTo: '2024-08-31',
        requester,
      });

      expect(repository.fetchMonthlyTrend).toHaveBeenCalledWith(
        supabaseClient,
        expect.objectContaining({
          dateFrom: new Date('2024-05-01T00:00:00.000Z'),
          dateTo: new Date('2024-06-15T00:00:00.000Z'),
        })
      );
      expect(result).toEqual([
        { period: '2024-05', sumNetPln: 100 },
        { period: '2024-06', sumNetPln: 80 },
        { period: '2024-07', sumNetPln: null },
        { period: '2024-08', sumNetPln: null },
      ]);
    });

    it('nie odpytuje repozytorium, gdy cały zakres jest w przyszłości', async () => {
      const requester = createRequester(['owner' as UserRoleValue]);

      const result = await service.getTrend({
        dateFrom: '2024-09-01',
        dateTo: '2024-10-31',
        requester,
      });

      expect(repository.fetchMonthlyTrend).not.toHaveBeenCalled();
      expect(result).toEqual([
        { period: '2024-09', sumNetPln: null },
        { period: '2024-10', sumNetPln: null },
      ]);
    });

    it('opakowuje błąd repozytorium w InternalServerErrorException', async () => {
      const errorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      repository.fetchMonthlyTrend.mockRejectedValue(
        new Error('Query timeout')
      );
      const requester = createRequester(['owner' as UserRoleValue]);

      await expect(
        service.getTrend({
          ...baseTrendCommand,
          requester,
        })
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});


