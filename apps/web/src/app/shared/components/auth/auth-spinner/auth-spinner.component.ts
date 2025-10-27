import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSpinModule } from 'ng-zorro-antd/spin';

@Component({
  selector: 'app-auth-spinner',
  standalone: true,
  imports: [CommonModule, NzSpinModule],
  templateUrl: './auth-spinner.component.html',
  styleUrl: './auth-spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSpinnerComponent {
  @Input() tip = 'Przetwarzanie...';
}
