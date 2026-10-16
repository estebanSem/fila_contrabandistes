import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FesteroService } from './services/festero.service';
import { Festero, isAdult } from '../../core/models/domain';
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
} from '../../shared/ui';
@Component({
  imports: [
    FormsModule,
    RouterLink,
    PageHeader,
    StatusBadge,
    EmptyState,
    LoadingState,
    ErrorState,
    ConfirmDialog,
  ],
  template: ` <app-page-header
      [title]="auth.canManage() ? 'Festeros' : 'Mi ficha y dependientes'"
      subtitle="Las personas que dan vida a nuestra filà."
    >
      @if (auth.canManage()) {
        <a class="button primary" routerLink="/festeros/nuevo">Añadir festero</a>
      }
    </app-page-header>
    <section class="panel">
      <div class="filters">
        <label
          >Buscar por nombre<input
            type="search"
            [ngModel]="search()"
            (ngModelChange)="filter('search', $event)"
            placeholder="Nombre o apellidos" /></label
        ><label
          >Estado<select [ngModel]="status()" (ngModelChange)="filter('status', $event)">
            <option value="">Todos</option>
            <option>ACTIVO</option>
            <option>BAJA</option>
          </select></label
        ><label
          >Edad<select [ngModel]="age()" (ngModelChange)="filter('age', $event)">
            <option value="">Todas</option>
            <option value="adult">Adultos</option>
            <option value="minor">Menores</option>
          </select></label
        >
      </div>
      <app-error-state [message]="error()" />
      @if (loading()) {
        <app-loading-state />
      } @else if (people().length) {
        <div class="table-scroll">
          <table>
            <caption>
              {{
                people().length
              }}
              personas visibles
            </caption>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (p of people(); track p.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/festeros', p.id]">{{ p.apellidos }}, {{ p.nombre }}</a
                    ><small>{{ adult(p.fecha_nacimiento) ? 'Adulto' : 'Menor' }}</small>
                  </td>
                  <td>{{ p.categoria }}</td>
                  <td><app-status-badge [status]="p.estado" /></td>
                  <td>
                    @if (auth.canManage() && p.estado === 'ACTIVO') {
                      <button (click)="pending.set(p)">Dar de baja</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <app-empty-state
          title="No hay personas que mostrar"
          description="Añade un festero o ajusta los filtros. Solo se muestran los datos a los que tienes acceso."
        />
      }
      <div class="actions" aria-label="Paginación">
        <button [disabled]="loading() || page() === 0" (click)="page.set(page() - 1)">
          Anterior
        </button>
        <p role="status">Página {{ page() + 1 }} · {{ count() }} personas</p>
        <button
          [disabled]="loading() || (page() + 1) * 25 >= count()"
          (click)="page.set(page() + 1)"
        >
          Siguiente
        </button>
      </div>
    </section>
    @if (pending()) {
      <app-confirm-dialog
        title="¿Dar de baja a esta persona?"
        description="Se conservará su ficha y su historial."
        (cancelled)="pending.set(null)"
        (confirmed)="deactivate()"
      />
    }`,
})
export class FesterosPage {
  readonly auth = inject(AuthService);
  private readonly service = inject(FesteroService);
  readonly people = signal<Festero[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly age = signal('');
  readonly pending = signal<Festero | null>(null);
  readonly adult = isAdult;
  readonly page = signal(0);
  readonly count = signal(0);
  private request = 0;
  constructor() {
    effect((cleanup) => {
      const tenant = this.auth.tenantId();
      const filters = {
        search: this.search(),
        status: this.status(),
        age: this.age(),
        page: this.page(),
      };
      this.people.set([]);
      this.pending.set(null);
      this.loading.set(true);
      const timer = setTimeout(() => {
        if (tenant) void this.load(tenant, filters);
        else this.loading.set(false);
      }, 200);
      cleanup(() => clearTimeout(timer));
    });
  }
  filter(field: 'search' | 'status' | 'age', value: string): void {
    this[field].set(value);
    this.page.set(0);
  }
  async load(
    tenant = this.auth.tenantId(),
    filters = { search: this.search(), status: this.status(), age: this.age(), page: this.page() },
  ): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.service.page(filters);
      if (request === this.request && tenant === this.auth.tenantId()) {
        this.people.set(result.people);
        this.count.set(result.count);
      }
    } catch {
      if (request === this.request) this.error.set('No se pudo cargar el padrón.');
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  async deactivate(): Promise<void> {
    const p = this.pending();
    this.pending.set(null);
    if (!p) return;
    try {
      await this.service.deactivate(p);
      await this.load();
    } catch {
      this.error.set('No se pudo dar de baja. Comprueba tus permisos.');
    }
  }
}
