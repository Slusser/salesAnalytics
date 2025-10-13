import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzSwitchModule } from 'ng-zorro-antd/switch'
import { NzTooltipModule } from 'ng-zorro-antd/tooltip'
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { debounceTime, distinctUntilChanged, map, skip } from 'rxjs'

import type { AppRole } from 'apps/shared/dtos/user-roles.dto'
import { FormsModule } from '@angular/forms'

export interface CustomersFilterValue {
  search?: string
  includeInactive?: boolean
}

const DEBOUNCE_MS = 300
const MAX_SEARCH_LENGTH = 120

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, NzInputModule, NzSwitchModule, NzTooltipModule],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {
  private readonly destroyRef = inject(DestroyRef)

  readonly value = input<CustomersFilterValue>({})
  readonly role = input<AppRole[]>([], { alias: 'role' })

  readonly change = output<Partial<CustomersFilterValue>>({ alias: 'onChange' })

  protected readonly search = signal('')
  protected readonly includeInactive = signal(false)

  protected readonly canToggleInactive = computed(() => {
    const roles = this.role().map((role: string) => role.toLowerCase())
    return roles.includes('owner') || roles.includes('editor')
  })

  constructor() {
    this.setupInputSync()
    this.setupSearchDebounce()
    this.setupIncludeGuard()
  }

  protected onSearchChange(value: string): void {
    this.search.set(value ?? '')
  }

  protected onToggleIncludeInactive(checked: boolean): void {
    if (!this.canToggleInactive()) {
      return
    }

    this.includeInactive.set(checked)
    this.change.emit({ includeInactive: checked })
  }

  protected clearSearch(): void {
    if (!this.search()) {
      return
    }

    this.search.set('')
    this.change.emit({ search: undefined })
  }

  private setupInputSync(): void {
    effect(
      () => {
        const incoming = this.value()
        const nextSearch = incoming?.search ?? ''
        const nextInclude = incoming?.includeInactive ?? false

        if (this.search() !== nextSearch) {
          this.search.set(nextSearch)
        }

        if (this.includeInactive() !== nextInclude) {
          this.includeInactive.set(nextInclude)
        }
      },
      { allowSignalWrites: true }
    )
  }

  private setupSearchDebounce(): void {
    toObservable(this.search)
      .pipe(
        skip(1),
        map((value) => value?.slice(0, MAX_SEARCH_LENGTH) ?? ''),
        map((value) => value.trim()),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((search) => {
        this.change.emit({ search: search || undefined })
      })
  }

  private setupIncludeGuard(): void {
    effect(
      () => {
        if (this.canToggleInactive()) {
          return
        }

        if (this.includeInactive()) {
          this.includeInactive.set(false)
          this.change.emit({ includeInactive: undefined })
        }
      },
      { allowSignalWrites: true }
    )
  }
}



