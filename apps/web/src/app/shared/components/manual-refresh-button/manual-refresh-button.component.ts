import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { CommonModule } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-manual-refresh-button',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzAlertModule],
  templateUrl: './manual-refresh-button.component.html',
  styleUrl: './manual-refresh-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualRefreshButtonComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());

  readonly disabled = input<boolean>(false);
  readonly refreshing = input<boolean>(false);
  readonly lastRefreshedAt = input<Date | undefined>(undefined);
  readonly ttlMs = input<number>(0);
  readonly errorMessage = input<string | null>(null);

  readonly clicked = output<void>();

  constructor() {
    interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  protected readonly cooldownSeconds = computed(() => {
    const ttl = this.ttlMs();
    const last = this.lastRefreshedAt();
    if (!ttl || !last) {
      return 0;
    }

    const nextAllowedAt = new Date(last).getTime() + ttl;
    return Math.max(0, Math.ceil((nextAllowedAt - this.now()) / 1_000));
  });

  protected readonly isCooldownActive = computed(
    () => this.cooldownSeconds() > 0
  );

  protected readonly buttonDisabled = computed(
    () =>
      this.disabled() || this.refreshing() || this.isCooldownActive()
  );

  protected readonly refreshStatusLabel = computed(() => {
    if (this.refreshing()) {
      return 'Trwa odświeżanie...';
    }

    if (this.isCooldownActive()) {
      return `Możliwe za ${this.cooldownSeconds()} s`;
    }

    return 'Gotowe do odświeżenia';
  });

  protected readonly lastRefreshedLabel = computed(() => {
    const timestamp = this.lastRefreshedAt();
    return timestamp ?? null;
  });

  protected onClick(): void {
    if (this.buttonDisabled()) {
      return;
    }

    this.clicked.emit();
  }

  protected readonly hasError = computed(() => Boolean(this.errorMessage()));
}
