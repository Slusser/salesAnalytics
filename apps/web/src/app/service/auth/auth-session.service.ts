import {
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

import type {
  AuthLoginResponse,
  AuthenticatedUserDto,
  AuthTokensDto,
} from 'apps/shared/dtos/auth.dto';
import { AppRole } from 'apps/shared/dtos/user-roles.dto';

interface SessionState {
  tokens: AuthTokensDto | null;
  user: AuthenticatedUserDto | null;
}

const STORAGE_KEY = 'salesAnalysis:auth';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly router = inject(Router);

  private readonly state = signal<SessionState>({ tokens: null, user: null });

  readonly user: Signal<AuthenticatedUserDto | null> = computed(
    () => this.state().user
  );
  readonly tokens: Signal<AuthTokensDto | null> = computed(
    () => this.state().tokens
  );
  readonly isLoggedIn = computed(() =>
    Boolean(this.state().tokens && this.state().user)
  );

  constructor() {
    this.restoreSession();
    effect(() => {
      const snapshot = this.state();
      if (!snapshot.tokens || !snapshot.user) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    });
  }

  setSession(response: AuthLoginResponse): void {
    this.state.set({ tokens: this.pickTokens(response), user: response.user });
  }

  clearSession(): void {
    this.state.set({ tokens: null, user: null });
    sessionStorage.removeItem(STORAGE_KEY);
  }

  hasRole(role: string): boolean {
    const user = this.user();
    if (!user) return false;
    return user.roles.includes(role as AppRole);
  }

  restoreSession(): void {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SessionState;
      if (!parsed.tokens?.accessToken || !parsed.user?.id) {
        this.clearSession();
        return;
      }
      this.state.set(parsed);
    } catch {
      this.clearSession();
    }
  }

  logout(options?: {
    redirectTo?: string | null;
    extras?: NavigationExtras;
  }): void {
    const redirectTo = options?.redirectTo ?? '/auth/login';
    this.clearSession();
    if (redirectTo === null) {
      return;
    }
    if (options?.extras) {
      this.router.navigate([redirectTo], options.extras);
      return;
    }
    this.router.navigateByUrl(redirectTo);
  }

  private pickTokens(response: AuthLoginResponse): AuthTokensDto {
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresIn,
    };
  }
}
