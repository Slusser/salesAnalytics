import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { NzAlertModule } from 'ng-zorro-antd/alert'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzInputNumberModule } from 'ng-zorro-antd/input-number'
import { FormsModule } from '@angular/forms'

import type { FxRateState } from '../../../../pages/orders/new/orders-new.types'

@Component({
  selector: 'app-fx-rate-banner',
  standalone: true,
  imports: [CommonModule, FormsModule, NzAlertModule, NzButtonModule, NzInputNumberModule],
  templateUrl: './fx-rate-banner.component.html',
  styleUrl: './fx-rate-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FxRateBannerComponent {
  readonly state = input.required<FxRateState>()
  readonly currency = input<'PLN' | 'EUR'>('PLN')
  readonly disabled = input(false)

  readonly refresh = output<void>()
  readonly overrideToggled = output<boolean>()
  readonly overrideChanged = output<number>()

  protected readonly manualRate = signal<number | null>(null)

  protected readonly isEur = computed(() => this.currency() === 'EUR')
  protected readonly showBanner = computed(() => this.isEur())
  protected readonly currentState = computed(() => this.state())
  protected readonly canEditRate = computed(
    () => this.state().manualOverride && !this.disabled()
  )

  protected onRefresh(): void {
    if (this.disabled()) {
      return
    }

    this.refresh.emit()
  }

  protected onToggleManual(): void {
    const next = !this.state().manualOverride
    this.manualRate.set(next ? this.state().rate ?? null : null)
    this.overrideToggled.emit(next)
  }

  protected onRateChange(value: number): void {
    this.manualRate.set(value)
    this.overrideChanged.emit(value)
  }
}

