import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';

type NavigationItem = {
  readonly label: string;
  readonly route: string;
  readonly exact?: boolean;
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzLayoutModule, NzMenuModule],
  templateUrl: './main.layout.html',
  styleUrl: './main.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  protected readonly currentYear = new Date().getFullYear();

  protected readonly navigation: NavigationItem[] = [
    {
      label: 'Kontrahenci',
      route: '/customers',
      exact: true,
    },
  ];
}


