import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AnalyticsOrdersService } from './analytics-orders.service';
import type { AnalyticsRepository } from './analytics.repository';
import type { SupabaseFactory } from '../../supabase/supabase.factory';
import type { Database } from '@db/database.types';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';

type AnalyticsRepositoryMock = {
  fetchDailyBreakdown: ReturnType<typeof vi.fn>;
};

type SupabaseFactoryMock = {
  create: ReturnType<typeof vi.fn>;
};

const baseCommand = {
  year: 2024,
  month: 5,
};

const defaultRole: UserRoleValue = 'viewer';

const createRequester = (
  overrides: Partial<CustomerMutatorContext> = {}
): CustomerMutatorContext => ({
  actorId: 'user-1',
  actorRoles: [defaultRole],
  accessToken: 'token-123',
  customerIds: ['cust-1', 'cust-2'],
  ...overrides,
});

describe('AnalyticsOrdersService', () => {
  let repository: AnalyticsRepositoryMock;
  let supabaseFactory: SupabaseFactoryMock;
  let service: AnalyticsOrdersService;
  let supabaseClient: SupabaseClient<Database>;

  beforeEach(() => {
    repository = {
      fetchDailyBreakdown: vi.fn(),
    };
    supabaseFactory = {
      create: vi.fn(),
    };
    supabaseClient = {} as SupabaseClient<Database>;
    supabaseFactory.create.mockReturnValue(supabaseClient);
    service = new AnalyticsOrdersService(
      repository as unknown as AnalyticsRepository,
      supabaseFactory as unknown as SupabaseFactory
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rzuca ForbiddenException, gdy requester nie istnieje', async () => {
    await expect(
      service.getDailyBreakdown({
        ...baseCommand,
        requester: undefined as unknown as CustomerMutatorContext,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.fetchDailyBreakdown).not.toHaveBeenCalled();
  });

  it('rzuca BadRequestException dla zakresu w przyszłości', async () => {
    const futureYear = new Date().getUTCFullYear() + 1;

    await expect(
      service.getDailyBreakdown({
        year: futureYear,
        month: 1,
        requester: createRequester(),
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('zwraca uzupełniony kalendarz i wywołuje repozytorium', async () => {
    repository.fetchDailyBreakdown.mockResolvedValue([
      { date: '2024-05-01', sumNetPln: 100.129, ordersCount: 1 },
      { date: '2024-05-03', sumNetPln: 200.0, ordersCount: 2 },
    ]);

    const result = await service.getDailyBreakdown({
      ...baseCommand,
      requester: createRequester(),
      customerId: 'cust-1',
    });

    expect(supabaseFactory.create).toHaveBeenCalledWith('token-123');
    expect(repository.fetchDailyBreakdown).toHaveBeenCalledWith(
      supabaseClient,
      expect.objectContaining({
        customerId: 'cust-1',
      })
    );
    expect(result[0]).toEqual({
      date: '2024-05-01',
      sumNetPln: 100.13,
      ordersCount: 1,
    });
    expect(result[1]).toEqual({
      date: '2024-05-02',
      sumNetPln: 0,
      ordersCount: 0,
    });
  });

  it('opakowuje błąd repozytorium w InternalServerErrorException', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    repository.fetchDailyBreakdown.mockRejectedValue(new Error('Timeout'));

    await expect(
      service.getDailyBreakdown({
        ...baseCommand,
        requester: createRequester(),
      })
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});


