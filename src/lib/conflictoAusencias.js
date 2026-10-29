/**
 * Conflicto ausencia ↔ jornada.
 *
 * Regla: si un operario tiene registrada una ausencia o falta (Vacacion o
 * FaltaAsistencia) en un día, ese día NO se puede registrar jornada
 * (Fichaje ni ApunteHorario). Se valida en los formularios de alta.
 */
import { base44 } from '@/api/base44Client';
import { unificarAusencias, metaAusencia } from '@/hooks/useAusenciasHorario';

const dia = (f) => (f ? String(f).slice(0, 10) : '');

const fechaCorta = (f) => {
  const d = dia(f);
  return d ? d.split('-').reverse().join('/') : '';
};

/**
 * Ausencia registrada para el operario en esa fecha (o null).
 * @returns {Promise<{tipo:string, operario_name:string, inicio:string, fin:string}|null>}
 */
export async function buscarAusenciaEnFecha(operarioId, fecha) {
  const d = dia(fecha);
  if (!operarioId || !d) return null;

  const [vacs, faltas] = await Promise.all([
    base44.entities.Vacacion.filter({ operario_id: operarioId, fecha_inicio: { $lte: d } }, { limit: 50 }),
    base44.entities.FaltaAsistencia.filter({ operario_id: operarioId, fecha_inicio: { $lte: d } }, { limit: 50 }),
  ]);

  const ausencias = unificarAusencias(vacs?.items || [], faltas?.items || []);
  return ausencias.find((a) => a.inicio && a.inicio <= d && (a.fin || a.inicio) >= d) || null;
}

/**
 * Mensaje de bloqueo si hay conflicto, o null si el día está libre.
 */
export async function mensajeConflictoAusencia(operarioId, fecha) {
  const ausencia = await buscarAusenciaEnFecha(operarioId, fecha);
  if (!ausencia) return null;
  const tipo = metaAusencia(ausencia.tipo).label;
  const quien = ausencia.operario_name || 'El operario';
  return `${quien} tiene registrada una ausencia (${tipo}) el ${fechaCorta(fecha)}. No se puede registrar jornada ese día.`;
}