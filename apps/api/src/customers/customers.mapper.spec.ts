import { describe, it, expect } from 'vitest';

import type { Tables } from '@db/database.types';

import { CustomerMapper } from './customers.mapper';

describe('CustomerMapper', () => {
  const baseRow: Tables<'customers'> = {
    id: 'customer-1',
    name: 'ACME Sp. z o.o.',
    is_active: true,
    created_at: '2024-01-10T12:30:00.000Z',
    updated_at: '2024-02-10T08:15:00.000Z',
    deleted_at: null,
  };

  it('mapuje wszystkie pola aktywnego klienta na DTO', () => {
    const dto = CustomerMapper.toDto(baseRow);

    expect(dto).toEqual({
      id: 'customer-1',
      name: 'ACME Sp. z o.o.',
      isActive: true,
      createdAt: '2024-01-10T12:30:00.000Z',
      updatedAt: '2024-02-10T08:15:00.000Z',
      deletedAt: null,
    });
  });

  it('zachowuje atrybuty klienta nieaktywnego z datą usunięcia', () => {
    const softDeletedRow: Tables<'customers'> = {
      ...baseRow,
      is_active: false,
      deleted_at: '2024-03-05T09:00:00.000Z',
      updated_at: '2024-03-05T09:00:00.000Z',
    };

    const dto = CustomerMapper.toDto(softDeletedRow);

    expect(dto).toEqual({
      id: 'customer-1',
      name: 'ACME Sp. z o.o.',
      isActive: false,
      createdAt: '2024-01-10T12:30:00.000Z',
      updatedAt: '2024-03-05T09:00:00.000Z',
      deletedAt: '2024-03-05T09:00:00.000Z',
    });
  });

  it('nie mutuje źródłowego wiersza z bazy danych', () => {
    const mutableRow: Tables<'customers'> = {
      ...baseRow,
      name: 'Nowa Nazwa',
      deleted_at: null,
    };
    const snapshot = { ...mutableRow };

    CustomerMapper.toDto(mutableRow);

    expect(mutableRow).toEqual(snapshot);
  });
});


