import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FesteroFormPage } from './festero-form.page';
import { AuthService } from '../../core/auth/auth.service';
import { FesteroService } from './services/festero.service';
describe('formulario de festero', () => {
  const save = vi.fn();
  beforeEach(() => {
    save.mockReset();
    TestBed.configureTestingModule({
      imports: [FesteroFormPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: AuthService, useValue: { tenantId: signal('A'), canManage: () => true } },
        { provide: FesteroService, useValue: { save } },
      ],
    });
  });
  it('rechaza alta anterior al nacimiento sin enviar datos al backend', async () => {
    const fixture = TestBed.createComponent(FesteroFormPage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      nombre: 'Nombre',
      apellidos: 'Apellido',
      fecha_nacimiento: '2000-01-01',
      fecha_alta: '1990-01-01',
    });
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Revisa');
  });
  it('exige fecha de baja al cambiar estado', async () => {
    const fixture = TestBed.createComponent(FesteroFormPage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      nombre: 'Nombre',
      apellidos: 'Apellido',
      fecha_nacimiento: '2000-01-01',
      estado: 'BAJA',
    });
    await fixture.componentInstance.save();
    expect(save).not.toHaveBeenCalled();
  });
  it('no admite fechas futuras ni campos de contacto malformados', async () => {
    const fixture = TestBed.createComponent(FesteroFormPage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      nombre: 'Nombre',
      apellidos: 'Apellido',
      fecha_nacimiento: '2090-01-01',
      email: 'incorrecto',
    });
    await fixture.componentInstance.save();
    expect(save).not.toHaveBeenCalled();
  });
});
