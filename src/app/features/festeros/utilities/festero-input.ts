import { FesteroInput } from '../../../core/models/domain';
export type FesteroFormValue = { [K in keyof FesteroInput]: string };
export function validFesteroDates(v: FesteroFormValue, today: string): boolean {
  return (
    !!v.fecha_nacimiento &&
    v.fecha_nacimiento <= today &&
    v.fecha_alta >= v.fecha_nacimiento &&
    (v.estado === 'ACTIVO'
      ? !v.fecha_baja
      : v.estado === 'BAJA' && !!v.fecha_baja && v.fecha_baja >= v.fecha_alta)
  );
}
export function normalizeFestero(v: FesteroFormValue): FesteroInput {
  return {
    ...v,
    nombre: v.nombre.trim(),
    apellidos: v.apellidos.trim(),
    categoria: v.categoria.trim(),
    estado: v.estado as 'ACTIVO' | 'BAJA',
    documento: v.documento.trim() || null,
    email: v.email.trim() || null,
    telefono: v.telefono.trim() || null,
    direccion: v.direccion.trim() || null,
    fecha_baja: v.fecha_baja || null,
  };
}
