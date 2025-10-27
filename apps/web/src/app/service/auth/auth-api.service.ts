import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import type {
  AuthLoginCommand,
  AuthLoginResponse,
  AuthLogoutCommand,
  AuthLogoutResponse,
} from 'apps/shared/dtos/auth.dto';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(command: AuthLoginCommand) {
    return this.http.post<AuthLoginResponse>('/api/auth/login', command);
  }

  logout(command: AuthLogoutCommand) {
    return this.http.post<AuthLogoutResponse>('/api/auth/logout', command);
  }
}
