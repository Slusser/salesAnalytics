import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTypographyModule } from 'ng-zorro-antd/typography';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [NzButtonModule, NzTypographyModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input<string>('😕');
  readonly title = input<string>('Brak wyników');
  readonly description = input<string>(
    'Spróbuj zmienić filtry lub parametry wyszukiwania.'
  );
  readonly actionLabel = input<string | null>(null);
  readonly actionType = input<'default' | 'primary'>('default');
  readonly actionLoading = input<boolean>(false);

  readonly action = output<void>();

  protected onAction(): void {
    if (!this.actionLabel()) {
      return;
    }
    this.action.emit();
  }
}
