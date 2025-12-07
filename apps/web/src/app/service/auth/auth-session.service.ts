import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

import type {
  AuthLoginResponse,
  AuthenticatedUserDto,
  AuthTokensDto,
} from '@shared/dtos/auth.dto';
import { AppRole } from '@shared/dtos/user-roles.dto';

interface SessionState {
  tokens: AuthTokensDto | null;
  user: AuthenticatedUserDto | null;
}

type PersistableSessionState = {
  tokens: AuthTokensDto;
  user: AuthenticatedUserDto;
};

const STORAGE_KEY = 'salesAnalysis:auth';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly state = signal<SessionState>({ tokens: null, user: null });
  private isSessionInitialized = false;
  private storageRef: Storage | null | undefined;

  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly user: Signal<AuthenticatedUserDto | null> = computed(
    () => {
      this.ensureSessionRestored();
      return this.state().user;
    }
  );
  readonly tokens: Signal<AuthTokensDto | null> = computed(
    () => {
      this.ensureSessionRestored();
      return this.state().tokens;
    }
  );
  readonly isLoggedIn = computed(() => {
    this.ensureSessionRestored();
    return Boolean(this.state().tokens && this.state().user);
  });

  constructor() {
    // Eagerly restore session on browser to ensure guards have access to auth state
    if (this.isBrowser) {
      this.ensureSessionRestored();
    }
  }

  setSession(response: AuthLoginResponse): void {
    this.ensureSessionRestored();
    this.state.set({ tokens: this.pickTokens(response), user: response.user });
    this.persistCurrentState();
  }

  clearSession(): void {
    this.ensureSessionRestored();
    this.state.set({ tokens: null, user: null });
    this.persistCurrentState();
    const storage = this.getStorage();
    if (storage) {
      this.callStorageRemoveItem(storage, STORAGE_KEY);
    }
  }

  hasRole(role: string): boolean {
    const user = this.user();
    if (!user) return false;
    return user.roles.includes(role as AppRole);
  }

  private ensureSessionRestored(): void {
    if (this.isSessionInitialized) {
      return;
    }
    this.isSessionInitialized = true;
    this.restoreSession();
  }

  private restoreSession(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    const raw = this.callStorageGetItem(storage, STORAGE_KEY);
    if (!raw) {
      this.callStorageRemoveItem(storage, STORAGE_KEY);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SessionState;
      if (!this.isSnapshotPersistable(parsed)) {
        this.callStorageRemoveItem(storage, STORAGE_KEY);
        return;
      }
      this.state.set(parsed);
      this.persistCurrentState();
    } catch {
      this.callStorageRemoveItem(storage, STORAGE_KEY);
    }
  }

  logout(options?: {
    redirectTo?: string | null;
    extras?: NavigationExtras;
  }): void {
    const redirectTo =
      options && 'redirectTo' in options ? options.redirectTo : undefined;
    const target = redirectTo === undefined ? '/auth/login' : redirectTo;
    this.clearSession();
    if (target === null) {
      return;
    }
    if (options?.extras) {
      this.router.navigate([target], options.extras);
      return;
    }
    this.router.navigateByUrl(target);
  }

  private pickTokens(response: AuthLoginResponse): AuthTokensDto {
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresIn,
    };
  }

  private persistCurrentState(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    const snapshot = this.state();
    if (!this.isSnapshotPersistable(snapshot)) {
      this.callStorageRemoveItem(storage, STORAGE_KEY);
      return;
    }

    this.callStorageSetItem(storage, STORAGE_KEY, JSON.stringify(snapshot));
  }

  private isSnapshotPersistable(
    snapshot: SessionState
  ): snapshot is PersistableSessionState {
    if (!snapshot.tokens || !snapshot.user) {
      return false;
    }

    const { accessToken, refreshToken } = snapshot.tokens;
    if (!accessToken || !refreshToken) {
      return false;
    }

    if (!snapshot.user.id) {
      return false;
    }

    return true;
  }

  private callStorageGetItem(storage: Storage, key: string): string | null {
    const runtimeWindow = (globalThis as { window?: Window }).window;
    if (runtimeWindow?.sessionStorage) {
      return runtimeWindow.sessionStorage.getItem(key);
    }

    if (typeof storage.getItem === 'function') {
      return storage.getItem(key);
    }

    return null;
  }

  private callStorageSetItem(
    storage: Storage,
    key: string,
    value: string
  ): void {
    const runtimeWindow = (globalThis as { window?: Window }).window;
    if (runtimeWindow?.sessionStorage) {
      runtimeWindow.sessionStorage.setItem(key, value);
      return;
    }

    if (typeof storage.setItem === 'function') {
      storage.setItem(key, value);
    }
  }

  private callStorageRemoveItem(storage: Storage, key: string): void {
    const runtimeWindow = (globalThis as { window?: Window }).window;
    if (runtimeWindow?.sessionStorage) {
      runtimeWindow.sessionStorage.removeItem(key);
      return;
    }

    if (typeof storage.removeItem === 'function') {
      storage.removeItem(key);
    }
  }

  private getStorage(): Storage | null {
    if (this.storageRef !== undefined) {
      return this.storageRef;
    }

    const runtimeGlobal = globalThis as {
      window?: Window & { sessionStorage?: Storage };
      sessionStorage?: Storage;
    };

    const storage =
      this.resolveStorage(() => runtimeGlobal.window?.sessionStorage) ??
      this.resolveStorage(() => runtimeGlobal.sessionStorage) ??
      this.resolveStorage(() => this.document?.defaultView?.sessionStorage) ??
      null;

    if (!storage) {
      return null;
    }

    this.storageRef = storage;
    return storage;
  }

  private resolveStorage(
    factory: () => Storage | null | undefined
  ): Storage | null {
    try {
      const storage = factory();
      if (!storage) {
        return null;
      }

      if (
        typeof storage.getItem !== 'function' ||
        typeof storage.setItem !== 'function' ||
        typeof storage.removeItem !== 'function'
      ) {
        return null;
      }

      return storage;
    } catch {
      return null;
    }
  }
}
