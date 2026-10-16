import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeader } from '../../shared/ui';
@Component({
  imports: [RouterLink, PageHeader],
  template: `<app-page-header
      title="Tu filà, más cerca"
      subtitle="Personas, familias y comunidad. Todo en un mismo lugar."
    />
    @if (!auth.tenantId()) {
      <section class="panel">
        <h2>Tu cuenta aún no tiene una filà asignada</h2>
        <p>
          Contacta con la administración para vincular tu cuenta. No es necesario crear otra cuenta.
        </p>
      </section>
    } @else {
      <div class="cards">
        <a class="panel feature-card" routerLink="/festeros"
          ><span class="eyebrow">01 · PERSONAS</span>
          <h2>{{ auth.canManage() ? 'Festeros' : 'Mi ficha y dependientes' }}</h2>
          <p>
            Consulta {{ auth.canManage() ? 'el padrón de la filà' : 'tu información autorizada' }}.
          </p>
          <span>Ver personas →</span></a
        ><a class="panel feature-card" routerLink="/familias"
          ><span class="eyebrow">02 · VÍNCULOS</span>
          <h2>Familias</h2>
          <p>Responsables y dependientes, con permisos claros.</p>
          <span>Ver relaciones →</span></a
        >
      </div>
    }`,
})
export class DashboardPage {
  readonly auth = inject(AuthService);
}
