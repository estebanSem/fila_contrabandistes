import { FamilyRelation, Festero, FesteroInput, Filada, Membership, UserRole } from './domain';
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
// Keep in sync with versioned SQL; replace using `supabase gen types typescript --local` after schema changes.
type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: { [K in keyof Row]: Row[K] };
  Insert: { [K in keyof Insert]: Insert[K] };
  Update: { [K in keyof Update]: Update[K] };
  Relationships: [];
};
export interface Database {
  public: {
    Tables: {
      filada: Table<Filada & { created_at: string }, { id?: string; nombre: string }>;
      perfil: Table<{ id: string; created_at: string }, { id: string }>;
      festero: Table<Festero, FesteroInput & { filada_id: string; id?: string }>;
      usuario_filada: Table<Membership, Omit<Membership, 'id'> & { id?: string }>;
      rol: Table<{ codigo: string; nombre: string }, { codigo: string; nombre: string }>;
      usuario_rol: Table<UserRole, UserRole>;
      responsable_festero: Table<FamilyRelation, Omit<FamilyRelation, 'id'> & { id?: string }>;
      audit_log: Table<
        {
          id: number;
          filada_id: string;
          usuario: string | null;
          accion: string;
          entidad: string;
          entity_id: string;
          fecha: string;
          metadata: Json;
        },
        never,
        never
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
