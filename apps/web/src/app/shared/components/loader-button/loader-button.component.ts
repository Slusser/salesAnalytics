import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { NzSpinModule } from 'ng-zorro-antd/spin'

export type LoaderButtonType = 'primary' | 'default' | 'dashed' | 'link' | 'text'

@Component({
  selector: 'app-loader-button',
  standalone: true,
  imports: [NzButtonModule, NzIconModule, NzSpinModule],
  templateUrl: './loader-button.component.html',
  styleUrl: './loader-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoaderButtonComponent {
  @Input() label = ''
  @Input() loading = false
  @Input() disabled = false
  @Input() htmlType: 'button' | 'submit' = 'button'
  @Input() nzType: LoaderButtonType = 'primary'
}
