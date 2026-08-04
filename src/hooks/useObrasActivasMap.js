import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Devuelve un mapa <obra_id, { id, name, client_id, client_name, activo }> unificado
 * que combina obras civiles (Obra) y solares (SolarObra).
 *
 * Útil para filtrar/ocultar documentos (planos, manuales, fotos, partes)
 * de obras marcadas como inactivas.
 *
 * El flag `activo` por defecto es `true` cuando la obra no lo define
 * (compatibilidad hacia atrás con obras creadas antes de este campo).
 */
export function useObrasActivasMap() {
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-activas-map-civil'],
    queryFn: () => base44.entities.Obra.list('name', 500),
    staleTime: 60_000,
  });
  const { data: solarObras = [] } = useQuery({
    queryKey: ['obras-activas-map-solar'],
    queryFn: () => base44.entities.SolarObra.list('name', 500),
    staleTime: 60_000,
  });

  const map = {};
  for (const o of obras) {
    map[o.id] = {
      id: o.id,
      name: o.name,
      client_id: o.client_id,
      client_name: o.client_name,
      activo: o.activo !== false,
    };
  }
  for (const o of solarObras) {
    map[o.id] = {
      id: o.id,
      name: o.name,
      client_id: o.client_id,
      client_name: o.client_name,
      activo: o.activo !== false,
    };
  }
  return map;
}

/**
 * Helper: filtra items cuya obra está marcada como inactiva.
 * Devuelve true si el item debe mostrarse (obra inexistente o activa, o usuario forzando inactivas).
 *
 * @param item - registro con campo `obra_id`
 * @param obrasMap - mapa devuelto por useObrasActivasMap
 * @param incluirInactivas - si el usuario activó "Mostrar inactivas"
 */
export function esItemVisible(item, obrasMap, incluirInactivas) {
  if (incluirInactivas) return true;
  const obraId = item?.obra_id || item?.proyecto_id;
  if (!obraId) return true; // documentos sin obra: siempre visibles
  const obra = obrasMap[obraId];
  if (!obra) return true; // obra no encontrada: mostrar para no ocultar por error
  return obra.activo !== false;
}