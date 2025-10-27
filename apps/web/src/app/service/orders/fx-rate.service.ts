import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { FxRateDto, FxRateQuery } from '@shared/dtos/fx-rates.dto';

@Injectable({ providedIn: 'root' })
export class FxRateService {
  private readonly http = inject(HttpClient);

  getRate(query: FxRateQuery): Observable<FxRateDto> {
    return this.http.get<FxRateDto>('/api/fx-rates', {
      params: query as Record<string, string>,
    });
  }
}
