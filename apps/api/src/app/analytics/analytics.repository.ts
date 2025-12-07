import { Injectable, Logger } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@db/database.types';
import type {
  AnalyticsKpiAggregate,
  AnalyticsKpiQuery,
} from './models/kpi.types';
import type {
  AnalyticsTrendQuery,
  AnalyticsTrendResult,
} from './models/trend.types';
import type {
  DailyOrdersAnalyticsItem,
  DailyOrdersAnalyticsQuery,
} from './models/daily.types';

type Supabase = SupabaseClient<Database>;

type TrendRpcRow = {
  period: string | null;
  sum_net_pln: number | null;
};

type OrdersRow = Database['public']['Tables']['orders']['Row'];
type OrderNetRow = Pick<
  OrdersRow,
  | 'order_date'
  | 'total_net_pln'
  | 'total_gross_pln'
  | 'distributor_price_pln'
  | 'customer_price_pln'
  | 'profit_pln'
>;
type OrderAmountRow = Pick<
  OrdersRow,
  | 'total_net_pln'
  | 'total_gross_pln'
  | 'distributor_price_pln'
  | 'customer_price_pln'
  | 'profit_pln'
>;

type TrendFallbackParams = {
  dateFromIso: string;
  dateToIso: string;
  customerId?: string;
};

const MONTHLY_TREND_RPC = 'analytics_monthly_trend';

@Injectable()
export class AnalyticsRepository {
  private readonly logger = new Logger(AnalyticsRepository.name);

  async fetchKpiAggregates(
    client: Supabase,
    query: AnalyticsKpiQuery
  ): Promise<AnalyticsKpiAggregate> {
    const dateFromIso = query.dateFrom.toISOString();
    const dateToIso = query.dateTo.toISOString();

    let builder = client
      .from('orders')
      .select(
        'total_net_pln,total_gross_pln,distributor_price_pln,customer_price_pln,profit_pln',
        {
        head: false,
        }
      )
      .is('deleted_at', null)
      .gte('order_date', dateFromIso)
      .lte('order_date', dateToIso);

    if (query.customerId) {
      builder = builder.eq('customer_id', query.customerId);
    }

    const { data, error } = await builder.returns<OrderAmountRow[]>();

    if (error) {
      this.logger.error('Błąd zapytania agregującego KPI', error);
      throw error;
    }

    return this.aggregateKpiRows(data ?? []);
  }

  async fetchDailyBreakdown(
    client: Supabase,
    query: DailyOrdersAnalyticsQuery
  ): Promise<DailyOrdersAnalyticsItem[]> {
    const monthStartIso = query.monthStart.toISOString();
    const monthEndIso = query.monthEnd.toISOString();

    let builder = client
      .from('orders')
      .select(
        'order_date,total_net_pln,total_gross_pln,distributor_price_pln,customer_price_pln,profit_pln',
        { head: false }
      )
      .is('deleted_at', null)
      .gte('order_date', monthStartIso)
      .lte('order_date', monthEndIso)
      .order('order_date', { ascending: true });

    if (query.customerId) {
      builder = builder.eq('customer_id', query.customerId);
    } else if (query.customerScope && query.customerScope.length > 0) {
      builder = builder.in('customer_id', query.customerScope);
    }

    const { data, error } = await builder.returns<OrderNetRow[]>();

    if (error) {
      this.logger.error(
        'Błąd zapytania agregującego dzienny rozkład sprzedaży',
        error
      );
      throw error;
    }

    return this.aggregateDailyRows(data ?? []);
  }

  async fetchMonthlyTrend(
    client: Supabase,
    query: AnalyticsTrendQuery
  ): Promise<AnalyticsTrendResult> {
    const dateFromIso = query.dateFrom.toISOString();
    const dateToIso = query.dateTo.toISOString();

    const { data, error } = (await client.rpc(
      MONTHLY_TREND_RPC as never,
      {
        date_from: dateFromIso,
        date_to: dateToIso,
        customer_id: query.customerId ?? null,
      } as never
    )) as { data: TrendRpcRow[] | null; error: PostgrestError | null };

    if (error) {
      const fallbackReason = this.isMissingTrendRpc(error)
        ? `Funkcja ${MONTHLY_TREND_RPC} nie jest dostępna`
        : 'Błąd RPC pobierającego trend sprzedaży';

      this.logger.warn(`${fallbackReason}; używam fallbacku PostgREST.`, error);

      return this.fetchTrendWithQueryBuilder(client, {
        dateFromIso,
        dateToIso,
        customerId: query.customerId,
      });
    }

    return this.mapTrendRows(data ?? []);
  }

  private async fetchTrendWithQueryBuilder(
    client: Supabase,
    params: TrendFallbackParams
  ): Promise<AnalyticsTrendResult> {
    let builder = client
      .from('orders')
      .select(
        'order_date,total_net_pln,total_gross_pln,distributor_price_pln,customer_price_pln,profit_pln',
        { head: false }
      )
      .is('deleted_at', null)
      .gte('order_date', params.dateFromIso)
      .lte('order_date', params.dateToIso);

    if (params.customerId) {
      builder = builder.eq('customer_id', params.customerId);
    }

    const { data, error } = await builder.returns<OrderNetRow[]>();

    if (error) {
      this.logger.error(
        'Błąd fallbackowego zapytania trendu sprzedaży',
        error
      );
      throw error;
    }

    return this.aggregateTrendRows(data ?? []);
  }

  private mapTrendRows(rows: TrendRpcRow[]): AnalyticsTrendResult {
    return rows
      .filter((row): row is TrendRpcRow & { period: string } => Boolean(row.period))
      .map((row) => ({
        period: row.period,
        sumNetPln: this.roundCurrency(Number(row.sum_net_pln ?? 0)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  private aggregateTrendRows(rows: OrderNetRow[]): AnalyticsTrendResult {
    if (rows.length === 0) {
      return [];
    }

    const buckets = new Map<string, number>();

    for (const row of rows) {
      const period = this.formatPeriod(row.order_date);

      if (!period) {
        continue;
      }

      const current = buckets.get(period) ?? 0;
      const addition = Number(row.total_net_pln ?? 0);
      buckets.set(period, current + addition);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, sumNetPln]) => ({
        period,
        sumNetPln: this.roundCurrency(sumNetPln),
      }));
  }

  private aggregateDailyRows(rows: OrderNetRow[]): DailyOrdersAnalyticsItem[] {
    if (rows.length === 0) {
      return [];
    }

    const buckets = new Map<
      string,
      {
        net: number;
        gross: number;
        distributor: number;
        customer: number;
        profit: number;
        count: number;
      }
    >();

    for (const row of rows) {
      const date = this.normalizeDate(row.order_date);

      if (!date) {
        continue;
      }

      const current =
        buckets.get(date) ?? {
          net: 0,
          gross: 0,
          distributor: 0,
          customer: 0,
          profit: 0,
          count: 0,
        };
      buckets.set(date, {
        net: current.net + Number(row.total_net_pln ?? 0),
        gross: current.gross + Number(row.total_gross_pln ?? 0),
        distributor: current.distributor + Number(row.distributor_price_pln ?? 0),
        customer: current.customer + Number(row.customer_price_pln ?? 0),
        profit: current.profit + Number(row.profit_pln ?? 0),
        count: current.count + 1,
      });
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, bucket]) => ({
        date,
        sumNetPln: this.roundCurrency(bucket.net),
        sumGrossPln: this.roundCurrency(bucket.gross),
        sumDistributorPln: this.roundCurrency(bucket.distributor),
        sumCustomerPln: this.roundCurrency(bucket.customer),
        sumProfitPln: this.roundCurrency(bucket.profit),
        avgMarginPct:
          bucket.net > 0
            ? this.roundCurrency(
                ((bucket.distributor - bucket.customer) / bucket.net) * 100
              )
            : 0,
        ordersCount: Math.max(0, Math.trunc(bucket.count)),
      }));
  }

  private normalizeDate(dateValue: string | null): string | null {
    if (!dateValue) {
      return null;
    }

    if (dateValue.length >= 10) {
      return dateValue.slice(0, 10);
    }

    const parsed = new Date(dateValue);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  private formatPeriod(dateValue: string | null): string | null {
    if (!dateValue) {
      return null;
    }

    const parsed = new Date(dateValue);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getUTCFullYear();
    const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');

    return `${year}-${month}`;
  }

  private roundCurrency(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private aggregateKpiRows(rows: OrderAmountRow[]): AnalyticsKpiAggregate {
    return rows.reduce<AnalyticsKpiAggregate>(
      (acc, row) => ({
        sumNetPln: acc.sumNetPln + Number(row.total_net_pln ?? 0),
        sumGrossPln: acc.sumGrossPln + Number(row.total_gross_pln ?? 0),
        sumDistributorPln:
          acc.sumDistributorPln + Number(row.distributor_price_pln ?? 0),
        sumCustomerPln:
          acc.sumCustomerPln + Number(row.customer_price_pln ?? 0),
        sumProfitPln: acc.sumProfitPln + Number(row.profit_pln ?? 0),
        ordersCount: acc.ordersCount + 1,
      }),
      {
        sumNetPln: 0,
        sumGrossPln: 0,
        sumDistributorPln: 0,
        sumCustomerPln: 0,
        sumProfitPln: 0,
        ordersCount: 0,
      }
    );
  }

  private isMissingTrendRpc(error: PostgrestError): boolean {
    return (
      error.code === '42883' || // undefined_function
      error.code === 'PGRST204' || // procedure not found
      error.code === 'PGRST201' // RPC unavailable
    );
  }
}


