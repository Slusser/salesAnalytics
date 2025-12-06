import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@db/database.types';
import type { AnalyticsTrendQuery } from './models/trend.types';
import { AnalyticsRepository } from './analytics.repository';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

type SupabaseStub = Pick<SupabaseClient<Database>, 'rpc' | 'from'>;

const createRequester = (): CustomerMutatorContext => ({
  actorId: 'actor-1',
  actorRoles: ['owner'] as CustomerMutatorContext['actorRoles'],
  accessToken: 'token',
});

const createTrendQuery = (
  overrides: Partial<AnalyticsTrendQuery> = {}
): AnalyticsTrendQuery => ({
  dateFrom: new Date('2024-01-01T00:00:00.000Z'),
  dateTo: new Date('2024-03-31T00:00:00.000Z'),
  requester: createRequester(),
  ...overrides,
});

describe('AnalyticsRepository', () => {
  let repository: AnalyticsRepository;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    repository = new AnalyticsRepository();
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchKpiAggregates', () => {
    const buildQuery = () => ({
      dateFrom: new Date('2024-01-01T00:00:00.000Z'),
      dateTo: new Date('2024-01-31T23:59:59.999Z'),
      requester: createRequester(),
    });

    const createBuilder = () => {
      const returns = vi.fn().mockResolvedValue({
        data: [
          { total_net_pln: 100.123 },
          { total_net_pln: null },
        ],
        error: null,
      });

      const builder = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        returns,
      };

      return { builder, returns };
    };

    it('sumuje wartości i liczy zamówienia dla zakresu dat', async () => {
      const { builder } = createBuilder();
      const supabase = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as SupabaseStub;

      const result = await repository.fetchKpiAggregates(
        supabase as SupabaseClient<Database>,
        buildQuery()
      );

      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(builder.select).toHaveBeenCalledWith('total_net_pln', { head: false });
      expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(builder.gte).toHaveBeenCalled();
      expect(builder.lte).toHaveBeenCalled();
      expect(result).toEqual({ sumNetPln: 100.123, ordersCount: 2 });
    });

    it('filtruje po customerId i propaguje błąd', async () => {
      const returns = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'db error' },
      });
      const builder = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        returns,
      };
      const supabase = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as SupabaseStub;

      await expect(
        repository.fetchKpiAggregates(supabase as SupabaseClient<Database>, {
          ...buildQuery(),
          customerId: 'cust-1',
        })
      ).rejects.toEqual({ message: 'db error' });

      expect(builder.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchDailyBreakdown', () => {
    const buildQuery = () => ({
      monthStart: new Date('2024-05-01T00:00:00.000Z'),
      monthEnd: new Date('2024-05-31T23:59:59.999Z'),
      requester: createRequester(),
    });

    const createBuilder = () => {
      const returns = vi.fn().mockResolvedValue({
        data: [
          {
            order_date: '2024-05-02T00:00:00.000Z',
            total_net_pln: 120.222,
          },
          {
            order_date: '2024-05-02T12:00:00.000Z',
            total_net_pln: 80.333,
          },
        ],
        error: null,
      });

      const builder = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        returns,
      };

      return { builder, returns };
    };

    it('agreguje dzienny rozkład i filtruje po customerId', async () => {
      const { builder } = createBuilder();
      const supabase = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as SupabaseStub;

      const result = await repository.fetchDailyBreakdown(
        supabase as SupabaseClient<Database>,
        {
          ...buildQuery(),
          customerId: 'customer-1',
        }
      );

      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(builder.select).toHaveBeenCalledWith('order_date,total_net_pln', {
        head: false,
      });
      expect(builder.eq).toHaveBeenCalledWith('customer_id', 'customer-1');
      expect(builder.order).toHaveBeenCalledWith('order_date', { ascending: true });
      expect(result).toEqual([
        { date: '2024-05-02', sumNetPln: 200.56, ordersCount: 2 },
      ]);
    });

    it('stosuje filtr IN dla customerScope', async () => {
      const { builder } = createBuilder();
      const supabase = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as SupabaseStub;

      await repository.fetchDailyBreakdown(
        supabase as SupabaseClient<Database>,
        {
          ...buildQuery(),
          customerScope: ['cust-1', 'cust-2'],
        }
      );

      expect(builder.in).toHaveBeenCalledWith('customer_id', ['cust-1', 'cust-2']);
      expect(builder.eq).not.toHaveBeenCalled();
    });

    it('loguje i propaguje błąd Supabase', async () => {
      const returns = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      const builder = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        returns,
      };
      const supabase = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as SupabaseStub;

      await expect(
        repository.fetchDailyBreakdown(supabase as SupabaseClient<Database>, buildQuery())
      ).rejects.toEqual({ message: 'DB error' });

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('zwraca posortowane dane z RPC, gdy funkcja jest dostępna', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { period: '2024-02', sum_net_pln: 200.555 },
        { period: '2024-01', sum_net_pln: null },
        { period: null, sum_net_pln: 999 },
      ],
      error: null,
    });

    const from = vi.fn();

    const supabase = { rpc, from } as SupabaseStub;

    const result = await repository.fetchMonthlyTrend(
      supabase as SupabaseClient<Database>,
      createTrendQuery()
    );

    expect(result).toEqual([
      { period: '2024-01', sumNetPln: 0 },
      { period: '2024-02', sumNetPln: 200.56 },
    ]);
    expect(from).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('wykorzystuje fallback PostgREST, gdy RPC nie istnieje', async () => {
    const rpcError = {
      code: '42883',
    } as PostgrestError;

    const returns = vi.fn().mockResolvedValue({
      data: [
        { order_date: '2024-04-15T00:00:00.000Z', total_net_pln: 40.234 },
        { order_date: '2024-04-02T00:00:00.000Z', total_net_pln: 9.771 },
      ],
      error: null,
    });

    const builder = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      returns,
    };

    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: rpcError }),
      from: vi.fn().mockReturnValue(builder),
    } as unknown as SupabaseStub;

    const result = await repository.fetchMonthlyTrend(
      supabase as SupabaseClient<Database>,
      createTrendQuery({ customerId: 'customer-1' })
    );

    expect(supabase.rpc).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(builder.select).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('customer_id', 'customer-1');
    expect(returns).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ period: '2024-04', sumNetPln: 50.01 }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});


