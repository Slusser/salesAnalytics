import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import type {
  AnalyticsKpiAggregate,
  AnalyticsKpiQuery,
  AnalyticsKpiResult,
} from './models/kpi.types';
import type {
  AnalyticsTrendResult,
  AnalyticsTrendQuery,
} from './models/trend.types';
import type { AnalyticsTrendCommand } from '@shared/dtos/analytics.dto';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import { AnalyticsRepository } from './analytics.repository';
import { SupabaseFactory } from '../../supabase/supabase.factory';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@db/database.types';

const MAX_TREND_MONTHS = 24;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly supabaseFactory: SupabaseFactory
  ) {}

  async getKpiAggregates(
    query: AnalyticsKpiQuery
  ): Promise<AnalyticsKpiResult> {
    const requester = this.ensureRequester(query.requester, 'KPI');

    if (query.customerId && !this.hasElevatedRole(requester)) {
      throw new ForbiddenException({
        code: 'ANALYTICS_KPI_FORBIDDEN',
        message: 'Brak uprawnień do filtrowania po customerId.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(requester.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ANALYTICS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    try {
      const rawAggregates = await this.analyticsRepository.fetchKpiAggregates(
        supabase,
        query
      );

      return this.toResult(rawAggregates);
    } catch (error) {
      this.logger.error(
        'Nie udało się pobrać agregatów KPI',
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ANALYTICS_KPI_FAILED',
        message: 'Nie udało się pobrać danych KPI.',
      });
    }
  }

  async getTrend(command: AnalyticsTrendCommand): Promise<AnalyticsTrendResult> {
    const requester = this.ensureRequester(command.requester, 'TREND');

    if (command.customerId && !this.hasElevatedRole(requester)) {
      throw new ForbiddenException({
        code: 'ANALYTICS_TREND_FORBIDDEN',
        message: 'Brak uprawnień do filtrowania po customerId.',
      });
    }

    const { dateFrom, dateTo } = this.ensureValidTrendRange(command);
    const today = this.normalizeDate(new Date());
    const shouldFetchData = dateFrom <= today;
    const queryDateTo = dateTo > today ? today : dateTo;

    const supabase = this.getSupabaseClientOrThrow(requester.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ANALYTICS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    let trend: AnalyticsTrendResult = [];

    if (shouldFetchData) {
      const query: AnalyticsTrendQuery = {
        dateFrom,
        dateTo: queryDateTo,
        customerId: command.customerId,
        requester,
      };

      try {
        trend = await this.analyticsRepository.fetchMonthlyTrend(supabase, query);
      } catch (error) {
        this.logger.error('Nie udało się pobrać trendu sprzedaży', error as Error);
        throw new InternalServerErrorException({
          code: 'ANALYTICS_TREND_FAILED',
          message: 'Nie udało się pobrać trendu sprzedaży.',
        });
      }
    }

    return this.appendFutureTrendNulls(trend, dateFrom, dateTo, today);
  }

  private toResult(raw: AnalyticsKpiAggregate): AnalyticsKpiResult {
    const sumNetPln = this.roundCurrency(raw.sumNetPln);
    const sumGrossPln = this.roundCurrency(raw.sumGrossPln);
    const sumDistributorPln = this.roundCurrency(raw.sumDistributorPln);
    const sumCustomerPln = this.roundCurrency(raw.sumCustomerPln);
    const sumProfitPln = this.roundCurrency(raw.sumProfitPln);
    const ordersCount = Number.isFinite(raw.ordersCount)
      ? Math.max(0, Math.trunc(raw.ordersCount))
      : 0;

    const avgOrderValue =
      ordersCount > 0 ? this.roundCurrency(sumNetPln / ordersCount) : 0;
    const avgMarginPct =
      sumNetPln > 0
        ? this.roundCurrency(
            ((sumDistributorPln - sumCustomerPln) / sumNetPln) * 100
          )
        : 0;

    return {
      sumNetPln,
      sumGrossPln,
      sumDistributorPln,
      sumCustomerPln,
      sumProfitPln,
      ordersCount,
      avgOrderValue,
      avgMarginPct,
    };
  }

  private roundCurrency(value: number): number {
    const normalized = Number.isFinite(value) ? value : 0;
    return Math.round(normalized * 100) / 100;
  }

  private ensureRequester(
    requester: CustomerMutatorContext | undefined,
    context: 'KPI' | 'TREND'
  ): CustomerMutatorContext {
    if (!requester) {
      throw new ForbiddenException({
        code: `ANALYTICS_${context}_FORBIDDEN`,
        message: 'Brak uwierzytelnionego użytkownika wykonującego operację.',
      });
    }

    return requester;
  }

  private hasElevatedRole(requester: CustomerMutatorContext): boolean {
    const roles = requester.actorRoles ?? [];
    return roles.some((role) => role === 'editor' || role === 'owner');
  }

  private ensureValidTrendRange(
    command: AnalyticsTrendCommand
  ): { dateFrom: Date; dateTo: Date } {
    const dateFrom = this.normalizeDate(
      this.parseDateOrThrow(command.dateFrom, 'dateFrom')
    );
    const dateTo = this.normalizeDate(
      this.parseDateOrThrow(command.dateTo, 'dateTo')
    );
    if (dateFrom > dateTo) {
      throw new BadRequestException({
        code: 'ANALYTICS_TREND_INVALID_RANGE',
        message: 'Data początkowa nie może być późniejsza niż końcowa.',
      });
    }

    const monthsSpan = this.calculateMonthSpan(dateFrom, dateTo);

    if (monthsSpan > MAX_TREND_MONTHS) {
      throw new BadRequestException({
        code: 'ANALYTICS_TREND_INVALID_RANGE',
        message: `Zakres trendu może obejmować maksymalnie ${MAX_TREND_MONTHS} kolejnych miesięcy.`,
      });
    }

    return { dateFrom, dateTo };
  }

  private parseDateOrThrow(value: string, field: 'dateFrom' | 'dateTo'): Date {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'ANALYTICS_TREND_INVALID_RANGE',
        message: `Parametr ${field} musi być poprawną datą.`,
      });
    }

    return parsed;
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }

  private calculateMonthSpan(start: Date, end: Date): number {
    const startMonthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const endMonthIndex = end.getUTCFullYear() * 12 + end.getUTCMonth();

    return endMonthIndex - startMonthIndex + 1;
  }

  private appendFutureTrendNulls(
    trend: AnalyticsTrendResult,
    requestedFrom: Date,
    requestedTo: Date,
    today: Date
  ): AnalyticsTrendResult {
    if (requestedTo <= today) {
      return trend;
    }

    const periods = this.collectTrendPeriods(requestedFrom, requestedTo);
    const existingPeriods = new Set(trend.map((entry) => entry.period));
    const todayPeriod = this.formatPeriod(today);
    const placeholders: AnalyticsTrendResult = [];

    for (const period of periods) {
      if (existingPeriods.has(period)) {
        continue;
      }

      if (period > todayPeriod) {
        placeholders.push({ period, sumNetPln: null });
      }
    }

    if (!placeholders.length) {
      return trend;
    }

    return [...trend, ...placeholders].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  }

  private collectTrendPeriods(dateFrom: Date, dateTo: Date): string[] {
    const periods: string[] = [];
    const cursor = this.getMonthStart(dateFrom);
    const target = this.getMonthStart(dateTo);

    while (cursor.getTime() <= target.getTime()) {
      periods.push(this.formatPeriod(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return periods;
  }

  private getMonthStart(date: Date): Date {
    const start = new Date(date);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  private formatPeriod(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  private getSupabaseClientOrThrow(
    accessToken: string | undefined,
    onMissing: () => never
  ): SupabaseClient<Database> {
    if (!accessToken) {
      onMissing();
    }

    return this.supabaseFactory.create(accessToken);
  }
}


