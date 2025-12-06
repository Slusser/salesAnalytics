import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AnalyticsRepository } from './analytics.repository';
import type {
  DailyOrdersAnalyticsCommand,
  DailyOrdersAnalyticsItem,
  DailyOrdersAnalyticsQuery,
} from './models/daily.types';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import { SupabaseFactory } from '../../supabase/supabase.factory';
import type { Database } from '@db/database.types';

const MIN_SUPPORTED_YEAR = 2000;

@Injectable()
export class AnalyticsOrdersService {
  private readonly logger = new Logger(AnalyticsOrdersService.name);

  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly supabaseFactory: SupabaseFactory
  ) {}

  async getDailyBreakdown(
    command: DailyOrdersAnalyticsCommand
  ): Promise<DailyOrdersAnalyticsItem[]> {
    const requester = this.ensureRequester(command.requester);
    this.ensureValidMonth(command.year, command.month);

    const rawScope = command.customerScope ?? requester.customerIds;
    const customerScope = this.normalizeScope(rawScope);
    const scopeProvided = Array.isArray(rawScope);

    if (command.customerId && customerScope && customerScope.length > 0) {
      this.ensureCustomerInScope(command.customerId, customerScope);
    }

    const { monthStart, monthEnd } = this.computeMonthRange(
      command.year,
      command.month
    );

    if (scopeProvided && (!customerScope || customerScope.length === 0)) {
      this.logger.warn(
        'Brak przypisanych klientów w zakresie użytkownika – zwracam pusty rozkład dzienny.'
      );
      return this.fillMissingDays(monthStart, monthEnd, []);
    }

    const supabase = this.getSupabaseClientOrThrow(requester.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ANALYTICS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    const query: DailyOrdersAnalyticsQuery = {
      monthStart,
      monthEnd,
      customerId: command.customerId,
      customerScope,
      requester,
    };

    try {
      const rows = await this.analyticsRepository.fetchDailyBreakdown(
        supabase,
        query
      );
      return this.fillMissingDays(monthStart, monthEnd, rows);
    } catch (error) {
      this.logger.error(
        'Nie udało się pobrać dziennego rozkładu sprzedaży',
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ANALYTICS_DAILY_FAILED',
        message: 'Nie udało się pobrać dziennego rozkładu sprzedaży.',
      });
    }
  }

  private ensureRequester(
    requester: CustomerMutatorContext | undefined
  ): CustomerMutatorContext {
    if (!requester) {
      throw new ForbiddenException({
        code: 'ANALYTICS_DAILY_FORBIDDEN',
        message: 'Brak uwierzytelnionego użytkownika wykonującego operację.',
      });
    }

    return requester;
  }

  private ensureValidMonth(year: number, month: number): void {
    if (!Number.isInteger(year) || year < MIN_SUPPORTED_YEAR) {
      throw new BadRequestException({
        code: 'ANALYTICS_INVALID_RANGE',
        message: 'Parametr year jest niepoprawny.',
      });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException({
        code: 'ANALYTICS_INVALID_RANGE',
        message: 'Parametr month jest niepoprawny.',
      });
    }

    const now = new Date();
    const requestedIndex = year * 12 + (month - 1);
    const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();

    if (requestedIndex > currentIndex) {
      throw new BadRequestException({
        code: 'ANALYTICS_INVALID_RANGE',
        message: 'Nie można pobrać danych dla przyszłego miesiąca.',
      });
    }
  }

  private computeMonthRange(
    year: number,
    month: number
  ): { monthStart: Date; monthEnd: Date } {
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    return { monthStart, monthEnd };
  }

  private normalizeScope(scope?: string[] | null): string[] | undefined {
    if (!Array.isArray(scope)) {
      return undefined;
    }

    const unique = Array.from(
      new Set(
        scope
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id))
      )
    );

    return unique;
  }

  private ensureCustomerInScope(
    customerId: string,
    customerScope: string[]
  ): void {
    if (!customerScope.includes(customerId)) {
      throw new ForbiddenException({
        code: 'ANALYTICS_DAILY_FORBIDDEN',
        message: 'Żądany klient nie należy do zakresu użytkownika.',
      });
    }
  }

  private fillMissingDays(
    monthStart: Date,
    monthEnd: Date,
    rows: DailyOrdersAnalyticsItem[]
  ): DailyOrdersAnalyticsItem[] {
    const bucket = new Map<string, DailyOrdersAnalyticsItem>();

    for (const row of rows) {
      bucket.set(row.date, {
        date: row.date,
        sumNetPln: this.roundCurrency(row.sumNetPln),
        ordersCount: Math.max(0, Math.trunc(row.ordersCount)),
      });
    }

    const result: DailyOrdersAnalyticsItem[] = [];
    const cursor = new Date(monthStart);

    while (cursor.getTime() <= monthEnd.getTime()) {
      const isoDate = this.formatDate(cursor);
      const existing = bucket.get(isoDate);

      result.push(
        existing ?? {
          date: isoDate,
          sumNetPln: 0,
          ordersCount: 0,
        }
      );

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private roundCurrency(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
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

