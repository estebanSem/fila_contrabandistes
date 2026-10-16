import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FesteroService } from './services/festero.service';
import { normalizeFestero, validFesteroDates } from './utilities/festero-input';
import { PageHeader, ErrorState, LoadingState } from '../../shared/ui';
@Component({
  imports: [ReactiveFormsModule, RouterLink, PageHeader, ErrorState, LoadingState],
  template: ` <app-page-header
      [title]="id ? 'Ficha de festero' : 'Nuevo festero'"
      subtitle="Recoge únicamente los datos necesarios para gestionar la pertenencia."
    />
    <a routerLink="/festeros">← Volver al listado</a>
    <section class="panel">
      <app-error-state [message]="error()" />
      @if (loading()) {
        <app-loading-state />
      }
      <form [formGroup]="form" (ngSubmit)="save()">
        <fieldset [disabled]="!auth.canManage() || loading() || saving()">
          <legend>Datos personales</legend>
          <div class="form-grid">
            <label>Nombre *<input formControlName="nombre" maxlength="100" required /></label
            ><label
              >Apellidos *<input formControlName="apellidos" maxlength="180" required
            /></label>
            <label
              >DNI / NIE<input
                formControlName="documento"
                maxlength="12"
                autocomplete="off"
              /><small>Opcional. Solo si existe una necesidad justificada.</small></label
            ><label
              >Fecha de nacimiento *<input
                type="date"
                formControlName="fecha_nacimiento"
                [max]="today"
                required
            /></label>
            <label>Correo<input type="email" formControlName="email" /></label
            ><label>Teléfono<input type="tel" formControlName="telefono" /></label
            ><label>Dirección<input formControlName="direccion" maxlength="500" /></label
            ><label>Categoría *<input formControlName="categoria" maxlength="60" required /></label>
            <label>Fecha de alta *<input type="date" formControlName="fecha_alta" required /></label
            ><label
              >Estado<select formControlName="estado">
                <option>ACTIVO</option>
                <option>BAJA</option>
              </select></label
            ><label>Fecha de baja<input type="date" formControlName="fecha_baja" /></label>
          </div>
        </fieldset>
        @if (auth.canManage()) {
          <p>Los campos con * son obligatorios.</p>
          <button class="primary" [disabled]="saving() || loading()">
            {{ saving() ? 'Guardando…' : 'Guardar ficha' }}
          </button>
        }
      </form>
    </section>`,
})
export class FesteroFormPage {
  readonly auth = inject(AuthService);
  private readonly service = inject(FesteroService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly today = new Date().toISOString().slice(0, 10);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellidos: ['', [Validators.required, Validators.maxLength(180)]],
    documento: ['', Validators.pattern(/^[A-Z0-9]{8,12}$/)],
    fecha_nacimiento: ['', Validators.required],
    email: ['', Validators.email],
    telefono: ['', Validators.pattern(/^\+?[0-9 ()-]{6,25}$/)],
    direccion: ['', Validators.maxLength(500)],
    fecha_alta: [this.today, Validators.required],
    fecha_baja: [''],
    estado: ['ACTIVO', Validators.required],
    categoria: ['SOCIO', [Validators.required, Validators.maxLength(60)]],
  });
  constructor() {
    let initial = true;
    effect(() => {
      const tenant = this.auth.tenantId();
      if (!initial) {
        void this.router.navigateByUrl('/festeros');
        return;
      }
      initial = false;
      if (tenant && this.id) void this.load(this.id, tenant);
    });
  }
  async load(id: string, tenant: string): Promise<void> {
    this.loading.set(true);
    try {
      const p = await this.service.get(id);
      if (tenant !== this.auth.tenantId()) return;
      this.form.patchValue({
        ...p,
        documento: p.documento ?? '',
        email: p.email ?? '',
        telefono: p.telefono ?? '',
        direccion: p.direccion ?? '',
        fecha_baja: p.fecha_baja ?? '',
      });
    } catch {
      this.error.set('Ficha no disponible o sin permiso de acceso.');
      this.form.disable();
    } finally {
      this.loading.set(false);
    }
  }
  async save(): Promise<void> {
    this.error.set('');
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (
      this.form.invalid ||
      !v.nombre.trim() ||
      !v.apellidos.trim() ||
      !validFesteroDates(v, this.today)
    ) {
      this.error.set(
        'Revisa los campos: nombre, fechas, correo, documento y teléfono deben ser válidos.',
      );
      return;
    }
    const value = normalizeFestero(v);
    this.saving.set(true);
    try {
      await this.service.save(value, this.id ?? undefined);
      await this.router.navigateByUrl('/festeros');
    } catch {
      this.error.set('No se pudo guardar. Revisa duplicados, fechas y permisos.');
    } finally {
      this.saving.set(false);
    }
  }
}
