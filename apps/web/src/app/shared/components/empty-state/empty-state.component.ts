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
  readonly title = input<string>('Brak wyników');
  readonly description = input<string>(
    'Spróbuj zmienić filtry lub parametry wyszukiwania.'
  );
  readonly hasCta = input<boolean>(false);

  readonly clear = output<void>({ alias: 'onClear' });

  protected onClear(): void {
    if (!this.hasCta()) return;
    this.clear.emit();
  }
}
