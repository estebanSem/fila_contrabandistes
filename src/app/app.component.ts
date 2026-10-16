import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');
  constructor() {
    effect(() => {
      const session = this.auth.session();
      const recovery = this.auth.recovery();
      if (!session || recovery) void this.router.navigateByUrl('/auth');
    });
  }
  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/auth');
    } catch {
      this.error.set('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    }
  }
  async tenant(event: Event): Promise<void> {
    this.auth.tenantId.set((event.target as HTMLSelectElement).value);
    await this.router.navigateByUrl('/');
  }
}
