import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/data/supabase.service';
import { Membership, UserRole } from '../../core/models/domain';
import { PageHeader, ErrorState } from '../../shared/ui';
interface AuditEntry {
  id: number;
  fecha: string;
  accion: string;
  entidad: string;
  entity_id: string;
}
@Component({
  imports: [ReactiveFormsModule, PageHeader, ErrorState],
  template: ` <app-page-header
      title="Administración"
      subtitle="Acceso restringido a administradores de esta filà."
    /><app-error-state [message]="error()" />
    <section class="panel">
      <h2>Vincular cuenta existente</h2>
      <p>El usuario debe existir en Supabase Auth. Utiliza su UUID; no introduzcas contraseñas.</p>
      <form [formGroup]="memberForm" (ngSubmit)="addMember()">
        <div class="form-grid">
          <label>UUID de usuario<input formControlName="usuario_id" required /></label
          ><label>UUID de festero (opcional)<input formControlName="festero_id" /></label>
        </div>
        <button [disabled]="busy()">Añadir pertenencia</button>
      </form>
    </section>
    <section class="panel">
      <h2>Roles por pertenencia</h2>
      <form [formGroup]="roleForm" (ngSubmit)="grant()">
        <div class="form-grid">
          <label
            >Usuario<select formControlName="usuario_filada_id">
              <option value="">Selecciona una cuenta</option>
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.usuario_id }}</option>
              }
            </select></label
          ><label
            >Rol<select formControlName="rol_codigo">
              @for (r of roles(); track r.codigo) {
                <option [value]="r.codigo">{{ r.nombre }}</option>
              }
            </select></label
          >
        </div>
        <button [disabled]="busy()">Asignar rol</button>
      </form>
      <ul>
        @for (r of assignments(); track r.usuario_filada_id + r.rol_codigo) {
          <li>
            {{ user(r.usuario_filada_id) }} · {{ r.rol_codigo }}
            <button [disabled]="busy()" (click)="revoke(r)">Revocar</button>
          </li>
        }
      </ul>
    </section>
    <section class="panel">
      <h2>Auditoría reciente</h2>
      <p>Solo identificadores y operaciones; no se registran datos personales completos.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Operación</th>
              <th>Entidad</th>
              <th>Identificador</th>
            </tr>
          </thead>
          <tbody>
            @for (a of audit(); track a.id) {
              <tr>
                <td>{{ a.fecha }}</td>
                <td>{{ a.accion }}</td>
                <td>{{ a.entidad }}</td>
                <td>{{ a.entity_id }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>`,
})
export class AdminPage {
  readonly auth = inject(AuthService);
  private readonly backend = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);
  readonly members = signal<Membership[]>([]);
  readonly roles = signal<{ codigo: string; nombre: string }[]>([]);
  readonly assignments = signal<UserRole[]>([]);
  readonly audit = signal<AuditEntry[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly memberForm = this.fb.nonNullable.group({
    usuario_id: ['', [Validators.required, Validators.pattern(/^[0-9a-f-]{36}$/i)]],
    festero_id: ['', Validators.pattern(/^[0-9a-f-]{36}$/i)],
  });
  readonly roleForm = this.fb.nonNullable.group({
    usuario_filada_id: ['', Validators.required],
    rol_codigo: ['FESTERO', Validators.required],
  });
  constructor() {
    effect(() => {
      const tenant = this.auth.tenantId();
      this.members.set([]);
      this.assignments.set([]);
      this.audit.set([]);
      if (tenant) void this.load(tenant);
    });
  }
  user(id: string): string {
    return this.members().find((m) => m.id === id)?.usuario_id ?? id;
  }
  async load(tenant = this.auth.tenantId()): Promise<void> {
    try {
      const [members, roles, assignments, audit] = await Promise.all([
        this.backend.db.from('usuario_filada').select('*').eq('filada_id', tenant),
        this.backend.db.from('rol').select('*'),
        this.backend.db.from('usuario_rol').select('*').eq('filada_id', tenant),
        this.backend.db
          .from('audit_log')
          .select('id,fecha,accion,entidad,entity_id')
          .eq('filada_id', tenant)
          .order('fecha', { ascending: false })
          .limit(50),
      ]);
      for (const r of [members, roles, assignments, audit]) if (r.error) throw r.error;
      if (tenant !== this.auth.tenantId()) return;
      this.members.set(members.data ?? []);
      this.roles.set(roles.data ?? []);
      this.assignments.set(assignments.data ?? []);
      this.audit.set(audit.data ?? []);
    } catch {
      this.error.set('No se pudo cargar la administración.');
    }
  }
  private async mutate(operation: () => PromiseLike<{ error: unknown }>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const { error } = await operation();
      if (error) throw error;
      await this.auth.loadContext();
      await this.load();
    } catch {
      this.error.set('Operación rechazada. Comprueba permisos, duplicados e identificadores.');
    } finally {
      this.busy.set(false);
    }
  }
  async addMember(): Promise<void> {
    if (this.memberForm.invalid) {
      this.error.set('Introduce UUID válidos.');
      return;
    }
    const v = this.memberForm.getRawValue();
    await this.mutate(() =>
      this.backend.db
        .from('usuario_filada')
        .insert({ ...v, festero_id: v.festero_id || null, filada_id: this.auth.tenantId() }),
    );
  }
  async grant(): Promise<void> {
    if (this.roleForm.invalid) return;
    await this.mutate(() =>
      this.backend.db
        .from('usuario_rol')
        .insert({ ...this.roleForm.getRawValue(), filada_id: this.auth.tenantId() }),
    );
  }
  async revoke(r: UserRole): Promise<void> {
    await this.mutate(() =>
      this.backend.db
        .from('usuario_rol')
        .delete()
        .eq('filada_id', this.auth.tenantId())
        .eq('usuario_filada_id', r.usuario_filada_id)
        .eq('rol_codigo', r.rol_codigo)
        .select('rol_codigo')
        .single(),
    );
  }
}
