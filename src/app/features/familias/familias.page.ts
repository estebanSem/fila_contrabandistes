import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { validFamilyInput } from './utilities/family-input';
import { FamilyService } from './services/family.service';
import { FesteroService } from '../festeros/services/festero.service';
import { FamilyRelation, Festero, isAdult } from '../../core/models/domain';
import { FesteroSelector } from '../festeros/festero-selector';
import { PageHeader, ErrorState, EmptyState, LoadingState, ConfirmDialog } from '../../shared/ui';
@Component({
  imports: [
    ReactiveFormsModule,
    FesteroSelector,
    PageHeader,
    ErrorState,
    EmptyState,
    LoadingState,
    ConfirmDialog,
  ],
  template: ` <app-page-header
      title="Familias y responsables"
      subtitle="Vínculos con autorización explícita y vigencia definida."
    /><app-error-state [message]="error()" />
    @if (auth.canManage()) {
      <section class="panel">
        <h2>{{ editing() ? 'Editar relación' : 'Añadir relación' }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <app-festero-selector
              label="Responsable adulto"
              [people]="adults()"
              [value]="form.controls.responsable_id.value"
              (selected)="form.controls.responsable_id.setValue($event)"
            />
            <app-festero-selector
              label="Dependiente"
              [people]="people()"
              [value]="form.controls.dependiente_id.value"
              (selected)="form.controls.dependiente_id.setValue($event)"
            />
            <label
              >Relación<select formControlName="tipo_relacion">
                <option>PADRE</option>
                <option>MADRE</option>
                <option>TUTOR</option>
                <option>RESPONSABLE</option>
                <option>OTRO</option>
              </select></label
            >
            <label>Desde<input type="date" formControlName="fecha_desde" required /></label
            ><label>Hasta (opcional)<input type="date" formControlName="fecha_hasta" /></label
            ><label class="check"
              ><input type="checkbox" formControlName="puede_gestionar" /> Autorizar acceso al
              dependiente</label
            >
          </div>
          <button class="primary" [disabled]="busy()">Guardar relación</button>
          @if (editing()) {
            <button type="button" (click)="editing.set(''); form.reset()">Cancelar edición</button>
          }
        </form>
      </section>
    }
    <section class="panel">
      <h2>Relaciones familiares</h2>
      @if (loading()) {
        <app-loading-state />
      } @else if (!relations().length) {
        <app-empty-state
          title="Sin relaciones visibles"
          description="Aquí aparecerán los vínculos familiares autorizados."
        />
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Dependiente</th>
                <th>Relación</th>
                <th>Vigencia / acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (r of relations(); track r.id) {
                <tr>
                  <td>{{ name(r.responsable_id) }}</td>
                  <td>{{ name(r.dependiente_id) }}</td>
                  <td>{{ r.tipo_relacion }}</td>
                  <td>
                    {{ r.fecha_desde }} — {{ r.fecha_hasta || 'Sin fin'
                    }}<small>{{
                      r.puede_gestionar ? 'Autorizado durante la vigencia' : 'Sin autorización'
                    }}</small>
                  </td>
                  <td>
                    @if (auth.canManage()) {
                      <button (click)="edit(r)">Editar</button>
                    }
                    @if (auth.canManage() && !r.fecha_hasta) {
                      <button (click)="pending.set(r.id)">Finalizar</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    @if (pending()) {
      <app-confirm-dialog
        title="¿Finalizar esta autorización?"
        description="El responsable dejará de tener acceso mediante esta relación."
        (cancelled)="pending.set('')"
        (confirmed)="end()"
      />
    }`,
})
export class FamiliasPage {
  readonly auth = inject(AuthService);
  private readonly families = inject(FamilyService);
  private readonly festeros = inject(FesteroService);
  private readonly fb = inject(FormBuilder);
  readonly people = signal<Festero[]>([]);
  readonly relations = signal<FamilyRelation[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly pending = signal('');
  readonly editing = signal('');
  readonly form = this.fb.nonNullable.group({
    responsable_id: ['', Validators.required],
    dependiente_id: ['', Validators.required],
    tipo_relacion: ['RESPONSABLE'],
    puede_gestionar: [false],
    fecha_desde: [new Date().toISOString().slice(0, 10), Validators.required],
    fecha_hasta: [''],
  });
  constructor() {
    effect(() => {
      const tenant = this.auth.tenantId();
      this.people.set([]);
      this.relations.set([]);
      this.form.reset();
      this.pending.set('');
      this.editing.set('');
      if (tenant) void this.load(tenant);
    });
  }
  adults(): Festero[] {
    return this.people().filter((p) => isAdult(p.fecha_nacimiento));
  }
  name(id: string): string {
    const p = this.people().find((p) => p.id === id);
    return p ? `${p.nombre} ${p.apellidos}` : 'Persona no visible';
  }
  async load(tenant = this.auth.tenantId()): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [people, relations] = await Promise.all([this.festeros.list(), this.families.list()]);
      if (tenant === this.auth.tenantId()) {
        this.people.set(people);
        this.relations.set(relations);
      }
    } catch {
      this.error.set('No se pudieron cargar las familias.');
    } finally {
      this.loading.set(false);
    }
  }
  async save(): Promise<void> {
    const v = this.form.getRawValue();
    this.error.set('');
    if (this.form.invalid || !validFamilyInput(v)) {
      this.error.set('Selecciona dos personas distintas y una vigencia válida.');
      return;
    }
    this.busy.set(true);
    try {
      await this.families.save(
        { ...v, fecha_hasta: v.fecha_hasta || null },
        this.editing() || undefined,
      );
      this.editing.set('');
      this.form.reset();
      await this.load();
    } catch {
      this.error.set(
        'No se pudo guardar. Comprueba la edad del responsable, duplicados y permisos.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  edit(r: FamilyRelation): void {
    this.editing.set(r.id);
    this.form.patchValue({ ...r, fecha_hasta: r.fecha_hasta ?? '' });
  }
  async end(): Promise<void> {
    const id = this.pending();
    this.pending.set('');
    try {
      await this.families.end(id);
      await this.load();
    } catch {
      this.error.set('No se pudo finalizar la relación.');
    }
  }
}
