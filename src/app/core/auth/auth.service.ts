import { computed, inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../data/supabase.service';
import { Filada, Membership, Role, UserRole, canManage } from '../models/domain';
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly backend = inject(SupabaseService);
  readonly session = signal<Session | null>(null);
  readonly filadas = signal<Filada[]>([]);
  readonly memberships = signal<Membership[]>([]);
  readonly assignments = signal<UserRole[]>([]);
  readonly tenantId = signal('');
  readonly recovery = signal(false);
  readonly roles = computed<Role[]>(() =>
    this.assignments()
      .filter(
        (r) =>
          r.filada_id === this.tenantId() &&
          this.memberships().some(
            (m) => m.id === r.usuario_filada_id && m.usuario_id === this.session()?.user.id,
          ),
      )
      .map((r) => r.rol_codigo),
  );
  readonly canManage = computed(() => canManage(this.roles()));
  readonly isAdmin = computed(() => this.roles().includes('ADMINISTRADOR'));
  private revision = 0;
  async initialize(): Promise<void> {
    if (!this.backend.configured) return;
    this.backend.db.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      if (event === 'PASSWORD_RECOVERY') this.recovery.set(true);
      // Supabase auth callbacks must not await another auth/database operation.
      setTimeout(() => {
        void this.loadContext().catch(() => this.clearContext());
      }, 0);
    });
    const initialized = await this.backend.db.auth.initialize();
    if (initialized.error) {
      this.backend.initializationError.set(
        'No se pudo validar el enlace de acceso. Solicita uno nuevo y ábrelo en el mismo navegador.',
      );
      history.replaceState(null, '', location.pathname);
    }
    const { data, error } = await this.backend.db.auth.getSession();
    if (error) throw error;
    this.session.set(data.session);
    await this.loadContext();
  }
  private clearContext(): void {
    this.filadas.set([]);
    this.memberships.set([]);
    this.assignments.set([]);
    this.tenantId.set('');
  }
  async loadContext(): Promise<void> {
    const revision = ++this.revision;
    if (!this.session()) {
      this.clearContext();
      return;
    }
    const userId = this.session()!.user.id;
    const [filadas, memberships, roles] = await Promise.all([
      this.backend.db.from('filada').select('id,nombre'),
      this.backend.db.from('usuario_filada').select('*').eq('usuario_id', userId),
      this.backend.db.from('usuario_rol').select('*'),
    ]);
    if (revision !== this.revision) return;
    for (const result of [filadas, memberships, roles]) if (result.error) throw result.error;
    this.filadas.set(filadas.data ?? []);
    this.memberships.set(memberships.data ?? []);
    this.assignments.set(roles.data ?? []);
    if (!this.filadas().some((f) => f.id === this.tenantId()))
      this.tenantId.set(this.filadas()[0]?.id ?? '');
  }
  async login(email: string, password: string): Promise<void> {
    const { data, error } = await this.backend.db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session.set(data.session);
    await this.loadContext();
  }
  async logout(): Promise<void> {
    const { error } = await this.backend.db.auth.signOut();
    if (error) throw error;
    this.session.set(null);
    this.clearContext();
  }
  async reset(email: string): Promise<void> {
    const { error } = await this.backend.db.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth`,
    });
    if (error) throw error;
  }
  async changePassword(password: string): Promise<void> {
    const { error } = await this.backend.db.auth.updateUser({ password });
    if (error) throw error;
    this.recovery.set(false);
  }
}
