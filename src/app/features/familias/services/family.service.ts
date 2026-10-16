import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/data/supabase.service';
import { FamilyRelation } from '../../../core/models/domain';
@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly backend = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  async list(): Promise<FamilyRelation[]> {
    const { data, error } = await this.backend.db
      .from('responsable_festero')
      .select('*')
      .eq('filada_id', this.auth.tenantId())
      .order('fecha_desde', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
  async save(value: Omit<FamilyRelation, 'id' | 'filada_id'>, id?: string): Promise<void> {
    const tenant = this.auth.tenantId();
    const query = id
      ? this.backend.db
          .from('responsable_festero')
          .update(value)
          .eq('id', id)
          .eq('filada_id', tenant)
      : this.backend.db.from('responsable_festero').insert({ ...value, filada_id: tenant });
    const { error } = await query.select('id').single();
    if (error) throw error;
  }
  async end(id: string): Promise<void> {
    const { error } = await this.backend.db
      .from('responsable_festero')
      .update({ fecha_hasta: new Date().toISOString().slice(0, 10), puede_gestionar: false })
      .eq('id', id)
      .eq('filada_id', this.auth.tenantId())
      .select('id')
      .single();
    if (error) throw error;
  }
}
