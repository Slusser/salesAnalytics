import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

@Component({
  selector: 'app-order-detail-skeleton',
  standalone: true,
  imports: [CommonModule, NzSkeletonModule],
  templateUrl: './skeleton-detail.component.html',
  styleUrl: './skeleton-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonDetailComponent {
  @Input() compact = false;
}

