import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';

@Component({
  selector: 'app-auth-error',
  standalone: true,
  imports: [CommonModule, NzAlertModule],
  templateUrl: './auth-error.component.html',
  styleUrl: './auth-error.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthErrorComponent {
  @Input() message?: string;
}
