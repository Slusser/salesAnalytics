import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { GetKpiAnalyticsQueryDto } from './get-kpi-analytics-query.dto';

const createDto = (overrides: Partial<GetKpiAnalyticsQueryDto> = {}) =>
  plainToInstance(GetKpiAnalyticsQueryDto, {
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    ...overrides,
  });

describe('GetKpiAnalyticsQueryDto', () => {
  it('przechodzi walidację dla poprawnych danych', () => {
    const dto = createDto({
      customerId: '7a1afcd1-6cc5-4aef-bae2-f2e4d15d807b',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('wymaga obecności dateFrom i dateTo', () => {
    const dto = createDto({
      dateFrom: undefined,
      dateTo: undefined,
    });

    const errors = validateSync(dto);

    expect(errors).not.toHaveLength(0);

    const properties = errors.map((error) => error.property);
    expect(properties).toContain('dateFrom');
    expect(properties).toContain('dateTo');
  });

  it('odrzuca zakres dłuższy niż 366 dni', () => {
    const dto = createDto({
      dateFrom: '2023-01-01',
      dateTo: '2024-03-05',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.AnalyticsDateRange).toContain(
      'Zakres dat nie może być dłuższy niż'
    );
  });

  it('odrzuca niepoprawny identyfikator klienta', () => {
    const dto = createDto({
      customerId: 'not-a-uuid',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('customerId');
  });
});


