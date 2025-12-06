import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import type {
  AnalyticsKpiResponseDto,
  AnalyticsTrendResponseDto,
  DailyOrdersAnalyticsItemDto,
} from '@shared/dtos/analytics.dto';

import type { DashboardFilters } from './dashboard-store.types';

type DailyParams = {
  year: number;
  month: number;
  customerId?: string;
};

@Injectable({ providedIn: 'root' })
export class AnalyticsDashboardApiService {
  private readonly http = inject(HttpClient);

  fetchKpi(filters: DashboardFilters) {
    const params = this.buildRangeParams(filters);
    return this.http.get<AnalyticsKpiResponseDto>('/api/analytics/kpi', {
      params,
      headers: { 'Cache-Control': 'no-cache' },
    });
  }

  fetchTrend(filters: DashboardFilters) {
    const params = this.buildRangeParams(filters);
    return this.http.get<AnalyticsTrendResponseDto>('/api/analytics/trend', {
      params,
      headers: { 'Cache-Control': 'no-cache' },
    });
  }

  fetchDaily(params: DailyParams) {
    const httpParams = new HttpParams({
      fromObject: this.cleanParams({
        year: params.year,
        month: params.month,
        customerId: params.customerId,
      }),
    });

    return this.http.get<DailyOrdersAnalyticsItemDto[]>(
      '/api/analytics/daily',
      {
        params: httpParams,
        headers: { 'Cache-Control': 'no-cache' },
      }
    );
  }

  private buildRangeParams(filters: DashboardFilters): HttpParams {
    return new HttpParams({
      fromObject: this.cleanParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        customerId: filters.customerId,
      }),
    });
  }

  private cleanParams<T extends Record<string, unknown>>(
    params: T
  ): Record<string, string> {
    return Object.entries(params).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === undefined || value === null || value === '') {
          return acc;
        }

        acc[key] = String(value);
        return acc;
      },
      {}
    );
  }
}


