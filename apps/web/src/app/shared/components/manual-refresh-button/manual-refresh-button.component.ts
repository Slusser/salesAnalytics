import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-manual-refresh-button',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  templateUrl: './manual-refresh-button.component.html',
  styleUrl: './manual-refresh-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualRefreshButtonComponent {
  readonly disabled = input<boolean>(false);
  readonly refreshing = input<boolean>(false);

  readonly clicked = output<void>();

  protected onClick(): void {
    if (this.disabled()) {
      return;
    }

    this.clicked.emit();
  }
}
