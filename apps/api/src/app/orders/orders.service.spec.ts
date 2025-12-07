import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type {
  CreateOrderCommand,
  ListOrdersQuery,
  ListOrdersResponse,
  OrderDetailDto,
  UpdateOrderCommand,
} from '@shared/dtos/orders.dto';

import { OrdersService } from './orders.service';
import type { OrdersRepository } from './orders.repository';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';
import type { SupabaseFactory } from '../../supabase/supabase.factory';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@db/database.types';

type OrdersRepositoryMock = {
  list: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByIdForUpdate: ReturnType<typeof vi.fn>;
  findActiveById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
};

type SupabaseFactoryMock = {
  create: ReturnType<typeof vi.fn>;
};

describe('OrdersService', () => {
  let repository: OrdersRepositoryMock;
  let service: OrdersService;
  let supabaseFactory: SupabaseFactoryMock;
  let supabaseClient: SupabaseClient<Database>;

  const elevatedUser: CustomerMutatorContext = {
    actorId: 'user-1',
    actorRoles: ['owner' as UserRoleValue],
    accessToken: 'token-owner',
  };

  const viewerUser: CustomerMutatorContext = {
    actorId: 'user-2',
    actorRoles: ['viewer' as UserRoleValue],
    accessToken: 'token-viewer',
  };

  const baseCommand: CreateOrderCommand = {
    orderNo: '  abc-123  ',
    customerId: 'customer-1',
    orderDate: '2024-05-10',
    itemName: '  Produkt  ',
    quantity: 10,
    catalogUnitGrossPln: 50,
    producerDiscountPct: 12,
    distributorDiscountPct: 5,
    vatRatePct: 23,
    totalNetPln: 100,
    totalGrossPln: 123,
    distributorPricePln: 95,
    customerPricePln: 90,
    profitPln: 5,
    comment: '  testowy komentarz  ',
  };

  const createOrderDetailDto = (
    overrides: Partial<OrderDetailDto> = {}
  ): OrderDetailDto => ({
    id: 'order-1',
    orderNo: 'ORDER-1',
    customerId: 'customer-1',
    orderDate: '2024-01-01',
    itemName: 'Produkt',
    quantity: 1,
    catalogUnitGrossPln: 50,
    producerDiscountPct: 0,
    distributorDiscountPct: 0,
    vatRatePct: 23,
    totalNetPln: 100,
    totalGrossPln: 123,
    distributorPricePln: 95,
    customerPricePln: 90,
    profitPln: 5,
    comment: 'Komentarz',
    createdBy: 'user-3',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  });

  const createRepositoryMock = (): OrdersRepositoryMock => ({
    list: vi.fn(),
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActiveById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  });

  beforeEach(() => {
    repository = createRepositoryMock();
    supabaseFactory = {
      create: vi.fn(),
    };
    supabaseClient = {} as SupabaseClient<Database>;
    supabaseFactory.create.mockReturnValue(supabaseClient);
    service = new OrdersService(
      repository as unknown as OrdersRepository,
      supabaseFactory as unknown as SupabaseFactory
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('rzuca ForbiddenException gdy użytkownik nie jest przekazany', async () => {
      const query: ListOrdersQuery = {};

      await expect(
        service.list(query, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.list).not.toHaveBeenCalled();
    });

    it('rzuca ForbiddenException gdy includeDeleted ustawione bez roli edytora', async () => {
      const query: ListOrdersQuery = { includeDeleted: true };

      await expect(service.list(query, viewerUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );

      expect(repository.list).not.toHaveBeenCalled();
    });

    it('używa wartości domyślnych przy nieobsługiwanym sortowaniu', async () => {
      const query: ListOrdersQuery = { sort: 'unknown' };
      const response: ListOrdersResponse = {
        items: [],
        limit: 25,
        page: 1,
        total: 0,
      };
      repository.list.mockResolvedValue(response);

      const result = await service.list(query, elevatedUser);

      expect(result).toBe(response);
      expect(repository.list).toHaveBeenCalledWith(supabaseClient, {
        page: 1,
        limit: 25,
        includeDeleted: false,
        customerId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sortField: 'createdAt',
        sortDirection: 'desc',
      });
    });

    it('przekazuje includeDeleted gdy użytkownik ma rolę właściciela', async () => {
      const query: ListOrdersQuery = {
        includeDeleted: true,
        page: 2,
        limit: 10,
        sort: 'orderDate:asc',
        customerId: 'customer-42',
      };
      const response: ListOrdersResponse = {
        items: [],
        limit: 10,
        page: 2,
        total: 0,
      };
      repository.list.mockResolvedValue(response);

      const result = await service.list(query, elevatedUser);

      expect(result).toBe(response);
      expect(repository.list).toHaveBeenCalledWith(supabaseClient, {
        page: 2,
        limit: 10,
        includeDeleted: true,
        customerId: 'customer-42',
        dateFrom: undefined,
        dateTo: undefined,
        sortField: 'orderDate',
        sortDirection: 'asc',
      });
    });

    it('opakowuje błędy repozytorium w InternalServerErrorException', async () => {
      repository.list.mockRejectedValue(new Error('db error'));

      await expect(service.list({}, elevatedUser)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });
  });

  describe('getById', () => {
    const order: OrderDetailDto = createOrderDetailDto();

    it('rzuca ForbiddenException gdy użytkownik nie jest przekazany', async () => {
      await expect(
        service.getById('order-1', null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('zwraca zamówienie i umożliwia dostęp do usuniętych dla ról uprzywilejowanych', async () => {
      repository.findById.mockResolvedValue(order);

      const result = await service.getById('order-1', elevatedUser);

      expect(result).toBe(order);
      expect(repository.findById).toHaveBeenCalledWith(
        supabaseClient,
        'order-1',
        {
        includeDeleted: true,
        }
      );
    });

    it('rzuca ForbiddenException gdy zamówienie ma deletedAt a użytkownik nie ma uprawnień', async () => {
      repository.findById.mockResolvedValue({
        ...order,
        deletedAt: '2024-02-02T00:00:00Z',
      });

      await expect(service.getById('order-1', viewerUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('rzuca NotFoundException gdy repository zwraca null', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('order-1', elevatedUser)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('opakowuje nieoczekiwane błędy w InternalServerErrorException', async () => {
      repository.findById.mockRejectedValue(new Error('boom'));

      await expect(service.getById('order-1', elevatedUser)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });
  });

  describe('create', () => {
    it('rzuca ForbiddenException gdy użytkownik nie jest przekazany', async () => {
      await expect(
        service.create(baseCommand, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca ForbiddenException gdy użytkownik nie ma roli edytora', async () => {
      await expect(service.create(baseCommand, viewerUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('normalizuje dane wejściowe przed utworzeniem zamówienia', async () => {
      const commandNeedingNormalization: CreateOrderCommand = {
        ...baseCommand,
        producerDiscountPct: 150,
        distributorDiscountPct: -10,
        vatRatePct: 150,
        totalNetPln: -100,
        totalGrossPln: -120,
      };
      const normalizedResponse: OrderDetailDto = createOrderDetailDto({
        id: 'order-id',
        orderNo: 'ABC-123',
        customerId: 'customer-1',
        orderDate: '2024-05-10',
        itemName: 'Produkt',
        quantity: 10,
        producerDiscountPct: 100,
        distributorDiscountPct: 0,
        vatRatePct: 100,
        catalogUnitGrossPln: 50,
        totalNetPln: 0,
        totalGrossPln: 0,
        distributorPricePln: 0,
        customerPricePln: 0,
        profitPln: 0,
        comment: 'testowy komentarz',
        createdBy: 'user-1',
        createdAt: '2024-05-10T12:00:00Z',
        updatedAt: '2024-05-10T12:00:00Z',
      });
      repository.create.mockResolvedValue(normalizedResponse);

      const result = await service.create(
        commandNeedingNormalization,
        elevatedUser
      );

      expect(result).toBe(normalizedResponse);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create.mock.calls[0][0]).toBe(supabaseClient);

      const payload = repository.create.mock.calls[0][1];
      expect(payload.actorId).toBe('user-1');
      expect(payload.command).toMatchObject({
        orderNo: 'ABC-123',
        itemName: 'Produkt',
        comment: 'testowy komentarz',
        producerDiscountPct: 100,
        distributorDiscountPct: 0,
        vatRatePct: 100,
        totalNetPln: 250,
        totalGrossPln: 500,
      });
    });

    it('nadpisuje niespójne kwoty wartościami wyliczonymi', async () => {
      const command: CreateOrderCommand = {
        ...baseCommand,
        catalogUnitGrossPln: 50,
        totalNetPln: 100,
        totalGrossPln: 150,
        distributorPricePln: 10,
        customerPricePln: 5,
        profitPln: 5,
      };
      const createdOrder = createOrderDetailDto({
        id: 'order-id',
        orderNo: 'ABC-123',
        customerId: 'customer-1',
        orderDate: '2024-05-10',
        itemName: 'Produkt',
        quantity: 10,
        catalogUnitGrossPln: 50,
        producerDiscountPct: 12,
        distributorDiscountPct: 5,
        vatRatePct: 23,
        totalNetPln: 406.5,
        totalGrossPln: 500,
        distributorPricePln: 386.18,
        customerPricePln: 357.72,
        profitPln: 28.46,
        comment: 'Komentarz',
        createdBy: 'user-1',
        createdAt: '2024-05-10T12:00:00Z',
        updatedAt: '2024-05-10T12:00:00Z',
      });
      repository.create.mockResolvedValue(createdOrder);

      const result = await service.create(command, elevatedUser);

      expect(result).toBe(createdOrder);
      const payload = repository.create.mock.calls[0][1];
      expect(payload.command.totalGrossPln).toBeCloseTo(500, 2);
      expect(payload.command.totalNetPln).toBeCloseTo(406.5, 2);
      expect(payload.command.distributorPricePln).toBeCloseTo(386.18, 1);
      expect(payload.command.customerPricePln).toBeCloseTo(357.72, 1);
      expect(payload.command.profitPln).toBeCloseTo(28.46, 1);
    });

    it('propaguje ConflictException z repozytorium', async () => {
      repository.create.mockRejectedValue(
        new ConflictException('duplicate order')
      );

      await expect(service.create(baseCommand, elevatedUser)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it('propaguje BadRequestException z repozytorium', async () => {
      repository.create.mockRejectedValue(
        new BadRequestException('invalid payload')
      );

      await expect(service.create(baseCommand, elevatedUser)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('opakowuje nieoczekiwane błędy w InternalServerErrorException', async () => {
      repository.create.mockRejectedValue(new Error('boom'));

      await expect(service.create(baseCommand, elevatedUser)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });
  });

  describe('update', () => {
    const updateCommand: UpdateOrderCommand = {
      ...baseCommand,
      deletedAt: '2024-05-01T00:00:00Z',
    };

    const updatedOrder: OrderDetailDto = createOrderDetailDto({
      orderNo: 'ABC-123',
      customerId: 'customer-1',
      orderDate: '2024-05-10',
      itemName: 'Produkt',
      quantity: 10,
      producerDiscountPct: 0,
      distributorDiscountPct: 0,
      vatRatePct: 23,
      totalNetPln: 100,
      totalGrossPln: 123,
      distributorPricePln: 95,
      customerPricePln: 90,
      profitPln: 5,
      comment: 'Komentarz',
      createdBy: 'user-1',
      createdAt: '2024-05-10T00:00:00Z',
      updatedAt: '2024-05-10T00:00:00Z',
      deletedAt: null,
    });

    it('rzuca ForbiddenException gdy użytkownik nie ma wymaganej roli', async () => {
      await expect(
        service.update('order-1', updateCommand, viewerUser)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca InternalServerErrorException gdy actorId nie jest ustawione', async () => {
      const user: CustomerMutatorContext = {
        actorId: '',
        actorRoles: ['owner' as UserRoleValue],
        accessToken: 'token-missing',
      };

      await expect(
        service.update('order-1', updateCommand, user)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca NotFoundException gdy zamówienie nie istnieje', async () => {
      repository.findByIdForUpdate.mockResolvedValue(null);

      await expect(
        service.update('order-1', updateCommand, elevatedUser)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('opakowuje błąd z findByIdForUpdate w InternalServerErrorException', async () => {
      repository.findByIdForUpdate.mockRejectedValue(new Error('db error'));

      await expect(
        service.update('order-1', updateCommand, elevatedUser)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('normalizuje dane wejściowe i wywołuje update w repozytorium', async () => {
      repository.findByIdForUpdate.mockResolvedValue({ id: 'order-1' });
      repository.update.mockResolvedValue(updatedOrder);

      const result = await service.update(
        'order-1',
        {
          ...updateCommand,
          producerDiscountPct: 150,
          distributorDiscountPct: -5,
          vatRatePct: 200,
          totalNetPln: -50,
          totalGrossPln: -60,
        },
        elevatedUser
      );

      expect(result).toBe(updatedOrder);
      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(repository.update.mock.calls[0][0]).toBe(supabaseClient);

      const payload = repository.update.mock.calls[0][1];
      expect(payload.actorId).toBe('user-1');
      if (!updateCommand.deletedAt) {
        throw new Error('Test setup error: deletedAt must be defined');
      }

      expect(payload.command).toMatchObject({
        producerDiscountPct: 100,
        distributorDiscountPct: 0,
        vatRatePct: 100,
        totalNetPln: 250,
        totalGrossPln: 500,
        deletedAt: new Date(updateCommand.deletedAt).toISOString(),
      });
    });

    it('propaguje ConflictException i BadRequestException z repozytorium', async () => {
      repository.findByIdForUpdate.mockResolvedValue({ id: 'order-1' });
      repository.update.mockRejectedValue(
        new ConflictException('duplicate order')
      );

      await expect(
        service.update('order-1', updateCommand, elevatedUser)
      ).rejects.toBeInstanceOf(ConflictException);

      repository.update.mockRejectedValue(
        new BadRequestException('invalid data')
      );

      await expect(
        service.update('order-1', updateCommand, elevatedUser)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('opakowuje pozostałe błędy w InternalServerErrorException', async () => {
      repository.findByIdForUpdate.mockResolvedValue({ id: 'order-1' });
      repository.update.mockRejectedValue(new Error('unexpected'));

      await expect(
        service.update('order-1', updateCommand, elevatedUser)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('delete', () => {
    it('rzuca ForbiddenException gdy użytkownik nie jest przekazany', async () => {
      await expect(
        service.delete('order-1', null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca InternalServerErrorException gdy actorId nie jest ustawione', async () => {
      await expect(
        service.delete('order-1', {
          actorId: '',
          actorRoles: ['owner' as UserRoleValue],
          accessToken: 'token-missing',
        })
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca ForbiddenException gdy użytkownik nie ma roli edytora', async () => {
      await expect(service.delete('order-1', viewerUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('rzuca NotFoundException gdy zamówienie nie istnieje', async () => {
      repository.findActiveById.mockResolvedValue(null);

      await expect(service.delete('order-1', elevatedUser)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('opakowuje błąd findActiveById w InternalServerErrorException', async () => {
      repository.findActiveById.mockRejectedValue(new Error('db error'));

      await expect(service.delete('order-1', elevatedUser)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('kończy sukcesem gdy soft-delete się powodzi', async () => {
      repository.findActiveById.mockResolvedValue(
        createOrderDetailDto({ id: 'order-1' })
      );
      repository.softDelete.mockResolvedValue(undefined);

      await expect(service.delete('order-1', elevatedUser)).resolves.toBeUndefined();

      expect(repository.softDelete).toHaveBeenCalledWith(supabaseClient, {
        actorId: 'user-1',
        command: { orderId: 'order-1' },
      });
    });

    it('opakowuje błędy softDelete w InternalServerErrorException', async () => {
      repository.findActiveById.mockResolvedValue(
        createOrderDetailDto({ id: 'order-1' })
      );
      repository.softDelete.mockRejectedValue(new Error('boom'));

      await expect(service.delete('order-1', elevatedUser)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });
  });
});


