import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { NzModalModule } from 'ng-zorro-antd/modal'

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [NzModalModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  readonly open = input<boolean>(false)
  readonly title = input<string>('Potwierdzenie')
  readonly description = input<string>('Czy na pewno chcesz kontynuować?')
  readonly confirmLabel = input<string>('Potwierdź')
  readonly cancelLabel = input<string>('Anuluj')

  readonly confirm = output<void>({ alias: 'onConfirm' })
  readonly close = output<void>({ alias: 'onClose' })

  protected onCancel(): void {
    this.close.emit()
  }

  protected onOk(): void {
    this.confirm.emit()
  }
}



