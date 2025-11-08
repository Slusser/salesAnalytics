import { describe, expect, it } from 'vitest';

import { AppService } from './app.service';

describe('AppService', () => {
  it('zwraca komunikat powitalny', () => {
    const service = new AppService();

    expect(service.getData()).toEqual({ message: 'Hello API' });
  });
});

