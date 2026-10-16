export type Role = 'ADMINISTRADOR' | 'JUNTA' | 'TESORERO' | 'FESTERO' | (string & {});
export interface Filada {
  id: string;
  nombre: string;
}
export interface Membership {
  id: string;
  usuario_id: string;
  filada_id: string;
  festero_id: string | null;
}
export interface UserRole {
  filada_id: string;
  usuario_filada_id: string;
  rol_codigo: Role;
}
export interface Festero {
  id: string;
  filada_id: string;
  nombre: string;
  apellidos: string;
  documento: string | null;
  fecha_nacimiento: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_alta: string;
  fecha_baja: string | null;
  estado: 'ACTIVO' | 'BAJA';
  categoria: string;
  created_at: string;
  updated_at: string;
}
export type FesteroInput = Omit<Festero, 'id' | 'filada_id' | 'created_at' | 'updated_at'>;
export interface FamilyRelation {
  id: string;
  filada_id: string;
  responsable_id: string;
  dependiente_id: string;
  tipo_relacion: string;
  puede_gestionar: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
}
export function isAdult(birth: string, at = new Date()): boolean {
  const [y, m, d] = birth.split('-').map(Number);
  const age =
    at.getFullYear() -
    y -
    (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d) ? 1 : 0);
  return age >= 18;
}
export function canManage(roles: readonly Role[]): boolean {
  return roles.some((r) => ['ADMINISTRADOR', 'JUNTA'].includes(r));
}

/** Last birth date that has reached 18, with a clamped leap-day anniversary. */
export function adultBirthCutoff(at = new Date()): string {
  const month = at.getMonth();
  const cutoff = new Date(at.getFullYear() - 18, month, at.getDate());
  if (cutoff.getMonth() !== month) cutoff.setDate(0);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
}
