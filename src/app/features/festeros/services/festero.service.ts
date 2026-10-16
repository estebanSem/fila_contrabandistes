import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/data/supabase.service';
import { adultBirthCutoff, Festero, FesteroInput } from '../../../core/models/domain';
@Injectable({ providedIn: 'root' })
export class FesteroService {
  private readonly db = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  async list(): Promise<Festero[]> {
    const result: Festero[] = [];
    const tenant = this.auth.tenantId();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.db.db
        .from('festero')
        .select('*')
        .eq('filada_id', tenant)
        .order('id')
        .range(offset, offset + 499);
      if (error) throw error;
      result.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) return result;
    }
  }
  async page(filters: {
    search: string;
    status: string;
    age: string;
    page: number;
  }): Promise<{ people: Festero[]; count: number }> {
    let query = this.db.db
      .from('festero')
      .select('*', { count: 'exact' })
      .eq('filada_id', this.auth.tenantId());
    const search = filters.search
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .trim()
      .slice(0, 100);
    for (const token of search.split(/\s+/).filter(Boolean))
      query = query.or(`nombre.ilike.%${token}%,apellidos.ilike.%${token}%`);
    if (filters.status === 'ACTIVO' || filters.status === 'BAJA')
      query = query.eq('estado', filters.status);
    if (filters.age) {
      const date = adultBirthCutoff();
      query =
        filters.age === 'adult'
          ? query.lte('fecha_nacimiento', date)
          : query.gt('fecha_nacimiento', date);
    }
    const { data, error, count } = await query
      .order('apellidos')
      .order('nombre')
      .order('id')
      .range(filters.page * 25, filters.page * 25 + 24);
    if (error) throw error;
    return { people: data ?? [], count: count ?? 0 };
  }
  async get(id: string): Promise<Festero> {
    const { data, error } = await this.db.db
      .from('festero')
      .select('*')
      .eq('filada_id', this.auth.tenantId())
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
  async save(value: FesteroInput, id?: string): Promise<void> {
    const tenant = this.auth.tenantId();
    const query = id
      ? this.db.db.from('festero').update(value).eq('filada_id', tenant).eq('id', id)
      : this.db.db.from('festero').insert({ ...value, filada_id: tenant });
    const { error } = await query.select('id').single();
    if (error) throw error;
  }
  async deactivate(festero: Festero): Promise<void> {
    const { error } = await this.db.db
      .from('festero')
      .update({ estado: 'BAJA', fecha_baja: new Date().toISOString().slice(0, 10) })
      .eq('filada_id', this.auth.tenantId())
      .eq('id', festero.id)
      .select('id')
      .single();
    if (error) throw error;
  }
}
