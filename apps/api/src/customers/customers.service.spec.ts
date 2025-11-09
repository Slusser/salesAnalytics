import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

import type { PostgrestError } from '@supabase/supabase-js';
import type { Tables } from '@db/database.types';
import type {
  CreateCustomerCommand,
  CustomerDto,
  CustomerMutatorContext,
  DeleteCustomerCommand,
  ListCustomersQuery,
  ListCustomersResponse,
} from '@shared/dtos/customers.dto';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';

import {
  CustomerCreateFailedError,
  CustomerDuplicateNameError,
  CustomersListFailedError,
  CustomersService,
} from './customers.service';
import { CustomerMapper } from './customers.mapper';
import type { CustomersRepository } from './customers.repository';

type CustomersRepositoryMock = {
  list: ReturnType<typeof vi.fn>;
  isActiveNameTaken: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  isActiveNameTakenByOther: ReturnType<typeof vi.fn>;
};

type CustomerRow = Tables<'customers'>;

const createRepositoryMock = (): CustomersRepositoryMock => ({
  list: vi.fn(),
  isActiveNameTaken: vi.fn(),
  insert: vi.fn(),
  findById: vi.fn(),
  softDelete: vi.fn(),
  update: vi.fn(),
  isActiveNameTakenByOther: vi.fn(),
});

const createCustomerRow = (overrides: Partial<CustomerRow> = {}): CustomerRow => ({
  id: 'customer-1',
  name: 'ACME',
  is_active: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides,
});

const createCustomerDto = (overrides: Partial<CustomerDto> = {}): CustomerDto => ({
  id: 'customer-1',
  name: 'ACME',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

const createPostgrestError = (
  overrides: Partial<PostgrestError> = {}
): PostgrestError => ({
  message: 'Database error',
  details: '',
  hint: '',
  code: 'P0000',
  name: 'DatabaseError',
  ...overrides,
});

describe('CustomersService', () => {
  let repository: CustomersRepositoryMock;
  let service: CustomersService;

  const ownerContext: CustomerMutatorContext = {
    actorId: 'actor-1',
    actorRoles: ['owner' as UserRoleValue],
  };

  const editorContext: CustomerMutatorContext = {
    actorId: 'actor-2',
    actorRoles: ['editor' as UserRoleValue],
  };

  const viewerContext: CustomerMutatorContext = {
    actorId: 'actor-3',
    actorRoles: ['viewer' as UserRoleValue],
  };

  beforeEach(() => {
    repository = createRepositoryMock();
    service = new CustomersService(repository as unknown as CustomersRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('rzuca CustomersListFailedError, gdy kontekst nie został przekazany', async () => {
      const query: ListCustomersQuery = {};

      await expect(
        service.list(query, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(CustomersListFailedError);

      expect(repository.list).not.toHaveBeenCalled();
    });

    it('rzuca ForbiddenException dla includeInactive i użytkownika bez uprawnień', async () => {
      const query: ListCustomersQuery = { includeInactive: true };

      await expect(service.list(query, viewerContext)).rejects.toBeInstanceOf(
        ForbiddenException
      );

      expect(repository.list).not.toHaveBeenCalled();
    });

    it('deleguje do repozytorium z wartościami domyślnymi i zwraca wynik', async () => {
      const query: ListCustomersQuery = { search: 'Acme' };
      const response: ListCustomersResponse = {
        items: [],
        total: 0,
        page: 1,
        limit: 25,
      };
      repository.list.mockResolvedValue(response);

      const result = await service.list(query, ownerContext);

      expect(result).toBe(response);
      expect(repository.list).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        includeInactive: false,
        search: 'Acme',
      });
    });

    it('opakowuje wyjątek repozytorium w CustomersListFailedError', async () => {
      const query: ListCustomersQuery = {};
      repository.list.mockRejectedValue(new Error('boom'));

      await expect(service.list(query, ownerContext)).rejects.toBeInstanceOf(
        CustomersListFailedError
      );
    });
  });

  describe('create', () => {
    const baseCommand: CreateCustomerCommand = {
      name: 'Nowy klient',
      isActive: true,
    };

    it('rzuca CustomerCreateFailedError, gdy brak kontekstu', async () => {
      await expect(
        service.create(baseCommand, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(CustomerCreateFailedError);
    });

    it('rzuca CustomerCreateFailedError dla pustej nazwy po trim', async () => {
      const command = { name: '    ', isActive: true } as CreateCustomerCommand;

      await expect(service.create(command, ownerContext)).rejects.toBeInstanceOf(
        CustomerCreateFailedError
      );

      expect(repository.isActiveNameTaken).not.toHaveBeenCalled();
    });

    it('rzuca CustomerDuplicateNameError, gdy nazwa jest zajęta', async () => {
      repository.isActiveNameTaken.mockResolvedValue(true);

      await expect(service.create(baseCommand, ownerContext)).rejects.toBeInstanceOf(
        CustomerDuplicateNameError
      );

      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('tworzy klienta z przyciętą nazwą i domyślną flagą isActive', async () => {
      const command = { name: '  ACME  ' } as CreateCustomerCommand;
      const dto = createCustomerDto({ name: 'ACME' });
      repository.isActiveNameTaken.mockResolvedValue(false);
      repository.insert.mockResolvedValue({ data: dto });

      const result = await service.create(command, editorContext);

      expect(result).toBe(dto);
      expect(repository.insert).toHaveBeenCalledWith({
        name: 'ACME',
        isActive: true,
        actorId: editorContext.actorId,
      });
    });

    it('rzuca CustomerDuplicateNameError, gdy insert kończy się błędem unikalności', async () => {
      repository.isActiveNameTaken.mockResolvedValue(false);
      repository.insert.mockResolvedValue({
        error: createPostgrestError({ code: '23505' }),
      });

      await expect(service.create(baseCommand, ownerContext)).rejects.toBeInstanceOf(
        CustomerDuplicateNameError
      );
    });

    it('rzuca CustomerCreateFailedError, gdy repozytorium nie zwróci danych', async () => {
      repository.isActiveNameTaken.mockResolvedValue(false);
      repository.insert.mockResolvedValue({});

      await expect(service.create(baseCommand, ownerContext)).rejects.toBeInstanceOf(
        CustomerCreateFailedError
      );
    });
  });

  describe('delete', () => {
    const baseCommand: DeleteCustomerCommand = {
      customerId: 'customer-1',
      actorId: ownerContext.actorId,
      actorRoles: ownerContext.actorRoles,
    };

    it('rzuca InternalServerErrorException, gdy command jest pusty', async () => {
      await expect(
        service.delete(null as unknown as DeleteCustomerCommand)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca InternalServerErrorException, gdy brakuje actorId', async () => {
      const command = { ...baseCommand, actorId: '' };

      await expect(service.delete(command)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('rzuca ForbiddenException dla użytkownika bez ról edytorskich', async () => {
      const command: DeleteCustomerCommand = {
        customerId: 'customer-1',
        actorId: viewerContext.actorId,
        actorRoles: viewerContext.actorRoles,
      };

      await expect(service.delete(command)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('rzuca InternalServerErrorException, gdy nie można pobrać klienta', async () => {
      repository.findById.mockResolvedValue({
        error: createPostgrestError(),
      });

      await expect(service.delete(baseCommand)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('rzuca NotFoundException, gdy klient nie istnieje', async () => {
      repository.findById.mockResolvedValue({ data: null });

      await expect(service.delete(baseCommand)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('zwraca aktualny stan klienta, jeśli został już usunięty', async () => {
      const row = createCustomerRow({ deleted_at: '2024-02-01T00:00:00.000Z' });
      const dto = createCustomerDto({ deletedAt: row.deleted_at });
      repository.findById.mockResolvedValue({ data: row });
      const mapperSpy = vi.spyOn(CustomerMapper, 'toDto').mockReturnValue(dto);

      const result = await service.delete(baseCommand);

      expect(result).toBe(dto);
      expect(mapperSpy).toHaveBeenCalledWith(row);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('rzuca InternalServerErrorException, gdy softDelete zwraca błąd', async () => {
      const row = createCustomerRow();
      repository.findById.mockResolvedValue({ data: row });
      repository.softDelete.mockResolvedValue({
        error: createPostgrestError(),
      });

      await expect(service.delete(baseCommand)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('rzuca NotFoundException, gdy softDelete nie zwróci danych', async () => {
      const row = createCustomerRow();
      repository.findById.mockResolvedValue({ data: row });
      repository.softDelete.mockResolvedValue({ data: null });

      await expect(service.delete(baseCommand)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('wykonuje softDelete i zwraca wynik repozytorium', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-03-15T10:00:00.000Z');
      vi.setSystemTime(now);
      const row = createCustomerRow();
      const dto = createCustomerDto({ isActive: false, deletedAt: now.toISOString() });
      repository.findById.mockResolvedValue({ data: row });
      repository.softDelete.mockResolvedValue({ data: dto });

      const result = await service.delete(baseCommand);

      expect(repository.softDelete).toHaveBeenCalledWith({
        customerId: baseCommand.customerId,
        deletedAt: now.toISOString(),
      });
      expect(result).toBe(dto);

      vi.useRealTimers();
    });
  });

  describe('getById', () => {
    const customerId = 'customer-1';

    it('rzuca InternalServerErrorException, gdy brak kontekstu', async () => {
      await expect(
        service.getById(customerId, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca InternalServerErrorException, gdy repozytorium zwróci błąd', async () => {
      repository.findById.mockResolvedValue({
        error: createPostgrestError(),
      });

      await expect(service.getById(customerId, ownerContext)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('rzuca NotFoundException, gdy klient nie istnieje', async () => {
      repository.findById.mockResolvedValue({ data: null });

      await expect(service.getById(customerId, ownerContext)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('rzuca NotFoundException, gdy klient jest usunięty i brak uprawnień', async () => {
      const row = createCustomerRow({ deleted_at: '2024-02-01T00:00:00.000Z' });
      repository.findById.mockResolvedValue({ data: row });

      await expect(service.getById(customerId, viewerContext)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('zwraca klienta z mappera, gdy użytkownik ma uprawnienia', async () => {
      const row = createCustomerRow({ deleted_at: '2024-02-01T00:00:00.000Z' });
      const dto = createCustomerDto({ deletedAt: row.deleted_at });
      repository.findById.mockResolvedValue({ data: row });
      const mapperSpy = vi.spyOn(CustomerMapper, 'toDto').mockReturnValue(dto);

      const result = await service.getById(customerId, ownerContext);

      expect(result).toBe(dto);
      expect(mapperSpy).toHaveBeenCalledWith(row);
    });
  });

  describe('update', () => {
    const customerId = 'customer-1';
    const row = createCustomerRow();

    it('rzuca InternalServerErrorException, gdy brak kontekstu', async () => {
      await expect(
        service.update(customerId, {}, null as unknown as CustomerMutatorContext)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca ForbiddenException, gdy użytkownik nie ma uprawnień', async () => {
      await expect(service.update(customerId, {}, viewerContext)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('rzuca InternalServerErrorException, gdy nie uda się pobrać klienta', async () => {
      repository.findById.mockResolvedValue({
        error: createPostgrestError(),
      });

      await expect(service.update(customerId, {}, ownerContext)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it('rzuca NotFoundException, gdy klient nie istnieje', async () => {
      repository.findById.mockResolvedValue({ data: null });

      await expect(service.update(customerId, {}, ownerContext)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('rzuca NotFoundException, gdy klient jest usunięty i nie następuje przywrócenie', async () => {
      const deletedRow = createCustomerRow({ deleted_at: '2024-02-01T00:00:00.000Z' });
      repository.findById.mockResolvedValue({ data: deletedRow });

      await expect(service.update(customerId, {}, ownerContext)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('rzuca BadRequestException, gdy nazwa po trim jest pusta', async () => {
      repository.findById.mockResolvedValue({ data: row });

      await expect(
        service.update(customerId, { name: '   ' }, ownerContext)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rzuca BadRequestException, gdy deletedAt nie jest null i isActive=false', async () => {
      repository.findById.mockResolvedValue({ data: row });

      await expect(
        service.update(
          customerId,
          { isActive: false, deletedAt: '2024-02-01T00:00:00.000Z' },
          ownerContext
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rzuca BadRequestException, gdy nazwa jest zajęta przez innego klienta', async () => {
      repository.findById.mockResolvedValue({ data: row });
      repository.isActiveNameTakenByOther.mockResolvedValue(true);

      await expect(
        service.update(customerId, { name: 'Inna nazwa' }, ownerContext)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ustawia deletedAt na bieżący czas przy zamknięciu klienta', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-04-10T09:30:00.000Z');
      vi.setSystemTime(now);
      repository.findById.mockResolvedValue({ data: row });
      repository.isActiveNameTakenByOther.mockResolvedValue(false);
      const dto = createCustomerDto({ isActive: false, deletedAt: now.toISOString() });
      repository.update.mockResolvedValue({ data: dto });

      const result = await service.update(
        customerId,
        { isActive: false },
        ownerContext
      );

      expect(repository.update).toHaveBeenCalledWith({
        customerId,
        name: undefined,
        isActive: false,
        deletedAt: now.toISOString(),
      });
      expect(result).toBe(dto);

      vi.useRealTimers();
    });

    it('czyści deletedAt podczas przywracania klienta', async () => {
      const deletedRow = createCustomerRow({ deleted_at: '2024-02-01T00:00:00.000Z' });
      repository.findById.mockResolvedValue({ data: deletedRow });
      repository.isActiveNameTakenByOther.mockResolvedValue(false);
      const dto = createCustomerDto({ isActive: true, deletedAt: null });
      repository.update.mockResolvedValue({ data: dto });

      const result = await service.update(
        customerId,
        { isActive: true },
        ownerContext
      );

      expect(repository.update).toHaveBeenCalledWith({
        customerId,
        name: undefined,
        isActive: true,
        deletedAt: null,
      });
      expect(result).toBe(dto);
    });

    it('rzuca InternalServerErrorException, gdy aktualizacja się nie powiedzie', async () => {
      repository.findById.mockResolvedValue({ data: row });
      repository.isActiveNameTakenByOther.mockResolvedValue(false);
      repository.update.mockResolvedValue({
        error: createPostgrestError(),
      });

      await expect(
        service.update(customerId, {}, ownerContext)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rzuca NotFoundException, gdy repozytorium nie zwróci danych po aktualizacji', async () => {
      repository.findById.mockResolvedValue({ data: row });
      repository.isActiveNameTakenByOther.mockResolvedValue(false);
      repository.update.mockResolvedValue({ data: null });

      await expect(
        service.update(customerId, {}, ownerContext)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('zwraca dane klienta z repozytorium po udanej aktualizacji', async () => {
      repository.findById.mockResolvedValue({ data: row });
      repository.isActiveNameTakenByOther.mockResolvedValue(false);
      const dto = createCustomerDto({ name: 'Nowa nazwa' });
      repository.update.mockResolvedValue({ data: dto });

      const result = await service.update(
        customerId,
        { name: ' Nowa nazwa ' },
        ownerContext
      );

      expect(repository.update).toHaveBeenCalledWith({
        customerId,
        name: 'Nowa nazwa',
        isActive: undefined,
        deletedAt: undefined,
      });
      expect(result).toBe(dto);
    });
  });
});


