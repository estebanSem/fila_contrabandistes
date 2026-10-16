import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from '../data/supabase.service';
import { Session } from '@supabase/supabase-js';
describe('AuthService', () => {
  const session = { user: { id: 'user' } } as Session;
  let mock: { db: { auth: Record<string, ReturnType<typeof vi.fn>> }; configured: boolean };
  let auth: AuthService;
  beforeEach(() => {
    mock = {
      configured: true,
      db: {
        auth: {
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
          resetPasswordForEmail: vi.fn(),
          updateUser: vi.fn(),
          getSession: vi.fn(),
          onAuthStateChange: vi.fn(),
        },
      },
    };
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: SupabaseService, useValue: mock }],
    });
    auth = TestBed.inject(AuthService);
  });
  it('inicia sesión y carga el contexto autorizado', async () => {
    mock.db.auth['signInWithPassword'].mockResolvedValue({ data: { session }, error: null });
    const load = vi.spyOn(auth, 'loadContext').mockResolvedValue();
    await auth.login('usuario@example.org', 'contraseña');
    expect(auth.session()).toEqual(session);
    expect(load).toHaveBeenCalled();
  });
  it('rechaza credenciales sin crear sesión', async () => {
    mock.db.auth['signInWithPassword'].mockResolvedValue({
      data: { session: null },
      error: new Error('invalid'),
    });
    await expect(auth.login('a', 'b')).rejects.toThrow();
    expect(auth.session()).toBeNull();
  });
  it('logout limpia sesión y datos del tenant', async () => {
    auth.session.set(session);
    auth.tenantId.set('A');
    auth.filadas.set([{ id: 'A', nombre: 'A' }]);
    mock.db.auth['signOut'].mockResolvedValue({ error: null });
    await auth.logout();
    expect(auth.session()).toBeNull();
    expect(auth.tenantId()).toBe('');
    expect(auth.filadas()).toEqual([]);
  });
  it('propaga errores de recuperación de contraseña', async () => {
    mock.db.auth['resetPasswordForEmail'].mockResolvedValue({ error: new Error('unavailable') });
    await expect(auth.reset('a@example.org')).rejects.toThrow('unavailable');
  });
  it('recalcula permisos al cambiar de filà', () => {
    auth.session.set(session);
    auth.memberships.set([
      { id: 'm1', usuario_id: 'user', filada_id: 'A', festero_id: null },
      { id: 'm2', usuario_id: 'user', filada_id: 'B', festero_id: null },
    ]);
    auth.assignments.set([
      { filada_id: 'A', usuario_filada_id: 'm1', rol_codigo: 'ADMINISTRADOR' },
      { filada_id: 'B', usuario_filada_id: 'm2', rol_codigo: 'FESTERO' },
    ]);
    auth.tenantId.set('A');
    expect(auth.isAdmin()).toBe(true);
    auth.tenantId.set('B');
    expect(auth.canManage()).toBe(false);
  });
  it('registra la recuperación antes de inicializar y procesa el evento de Auth', async () => {
    let notify: (event: string, session: Session | null) => void = () => undefined;
    mock.db.auth['onAuthStateChange'].mockImplementation(
      (listener: (event: string, session: Session | null) => void) => {
        notify = listener;
      },
    );
    mock.db.auth['initialize'] = vi.fn().mockImplementation(async () => {
      expect(mock.db.auth['onAuthStateChange']).toHaveBeenCalled();
      return { error: null };
    });
    mock.db.auth['getSession'].mockResolvedValue({ data: { session: null }, error: null });
    const load = vi.spyOn(auth, 'loadContext').mockResolvedValue();
    await auth.initialize();
    notify('PASSWORD_RECOVERY', session);
    expect(auth.recovery()).toBe(true);
    expect(auth.session()).toEqual(session);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
