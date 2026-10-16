import { FamilyRelation } from '../../../core/models/domain';
export function validFamilyInput(v: Omit<FamilyRelation, 'id' | 'filada_id'>): boolean {
  return (
    !!v.responsable_id &&
    !!v.dependiente_id &&
    v.responsable_id !== v.dependiente_id &&
    !!v.fecha_desde &&
    (!v.fecha_hasta || v.fecha_hasta >= v.fecha_desde)
  );
}
