/**
 * Lógica compartida del expediente legal de control horario.
 *
 * Principio: el Fichaje es OPERATIVO; el RegistroHorarioLegal es la versión
 * legal versionada. Aquí se construye esa versión a partir del fichaje y se
 * deja rastro en AuditoriaHorario. La comparten forzarCierreFichajes,
 * gestionRegistroHorarioLegal y completarFichajesAutomaticos.
 */

export const ESTADOS_OFICIALES = ['oficial', 'validado_admin'];

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function toMin(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function pausaMinutos(fichaje) {
  const ini = toMin(fichaje?.pausa_inicio);
  const fin = toMin(fichaje?.pausa_fin);
  if (ini === null || fin === null) return 0;
  return Math.max(0, fin - ini);
}

export function diaSemana(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return DIAS[d.getDay()] || '';
}

/** Construye el objeto de un registro legal a partir de un fichaje + operario. */
export function construirRegistroLegal({ fichaje, operario, estadoLegal, origen, usuario, versionLegal }) {
  const pausa = pausaMinutos(fichaje);
  const horas = Number(fichaje?.horas_trabajadas) || 0;
  return {
    fichaje_id: fichaje.id,
    operario_id: fichaje.operario_id,
    operario_name: fichaje.operario_name || operario?.name || '',
    operario_email: operario?.user_email || operario?.email || '',
    operario_dni: operario?.dni || '',
    empresa_id: operario?.empresa_id || '',
    empresa_nombre: operario?.empresa_nombre || '',
    centro_trabajo_id: '',
    centro_trabajo_nombre: '',
    fecha: String(fichaje.date || '').slice(0, 10),
    dia_semana: diaSemana(String(fichaje.date || '').slice(0, 10)),
    hora_entrada: fichaje.hora_entrada || '',
    hora_salida: fichaje.hora_salida || '',
    pausa_inicio: fichaje.pausa_inicio || '',
    pausa_fin: fichaje.pausa_fin || '',
    pausa_minutos: pausa,
    jornada_real_minutos: Math.round(horas * 60) + pausa,
    horas_trabajadas: horas,
    horas_extra_ordinarias: 0,
    horas_extra_festivas: 0,
    horas_nocturnas: 0,
    horas_festivas: 0,
    obra_id: fichaje.obra_id || '',
    obra_nombre: fichaje.obra_name || fichaje.project || '',
    obra_tipo: fichaje.obra_tipo || '',
    notas: fichaje.notas || '',
    origen,
    fuente_registro: fichaje.origen || 'trabajador',
    estado_legal: estadoLegal,
    version_legal: versionLegal,
    generado_por: usuario?.email || 'sistema',
  };
}

/** Registra un evento de auditoría. Nunca debe romper la operación principal. */
export async function registrarAuditoria(base44, evento) {
  try {
    await base44.asServiceRole.entities.AuditoriaHorario.create({
      entidad: evento.entidad || 'RegistroHorarioLegal',
      registro_id: evento.registro_id || '',
      accion: evento.accion,
      usuario: evento.usuario || 'sistema',
      rol: evento.rol || '',
      fecha_hora: new Date().toISOString(),
      campo: evento.campo || '',
      valor_anterior: evento.valor_anterior === undefined ? '' : String(evento.valor_anterior),
      valor_nuevo: evento.valor_nuevo === undefined ? '' : String(evento.valor_nuevo),
      motivo: evento.motivo || '',
      origen: evento.origen || 'app',
      version_legal: evento.version_legal ?? null,
    });
  } catch (_e) {
    // La trazabilidad nunca bloquea el cierre ni la validación.
  }
}

/**
 * Genera o actualiza la versión legal PROVISIONAL de un fichaje.
 * - Si ya existe una versión oficial/validada → no la toca (devuelve skip).
 * - Si la última es provisional → la actualiza (sin crear duplicados al re-generar).
 * - Si no existe o está corregida/anulada → crea una nueva versión.
 */
export async function generarProvisional(base44, { fichaje, operario, usuario, origen, motivo }) {
  const res = await base44.asServiceRole.entities.RegistroHorarioLegal.filter({ fichaje_id: fichaje.id });
  const existentes = (Array.isArray(res) ? res : (res?.items || []))
    .slice()
    .sort((a, b) => (Number(b.version_legal) || 0) - (Number(a.version_legal) || 0))
    .slice(0, 5);
  const oficial = existentes.find((r) => ESTADOS_OFICIALES.includes(r.estado_legal));
  if (oficial) return { skipped: true, motivo: 'ya_oficial' };

  const ultimo = existentes[0];
  const version = existentes.reduce((max, r) => Math.max(max, Number(r.version_legal) || 0), 0) + 1;
  const estadoLegal = 'provisional';

  if (ultimo && ultimo.estado_legal === 'provisional') {
    const data = construirRegistroLegal({
      fichaje, operario, estadoLegal, origen, usuario, versionLegal: ultimo.version_legal || 1,
    });
    await base44.asServiceRole.entities.RegistroHorarioLegal.update(ultimo.id, data);
    await registrarAuditoria(base44, {
      registro_id: ultimo.id,
      accion: 'registro_legal_provisional_actualizado',
      usuario: usuario?.email,
      rol: usuario?.role,
      motivo,
      origen: origen || 'app',
      version_legal: ultimo.version_legal || 1,
    });
    return { updated: true, id: ultimo.id };
  }

  const data = construirRegistroLegal({ fichaje, operario, estadoLegal, origen, usuario, versionLegal: version });
  const creado = await base44.asServiceRole.entities.RegistroHorarioLegal.create(data);
  await registrarAuditoria(base44, {
    registro_id: creado.id,
    accion: 'registro_legal_provisional_generado',
    usuario: usuario?.email,
    rol: usuario?.role,
    motivo,
    origen: origen || 'app',
    version_legal: version,
  });
  return { created: true, id: creado.id };
}

/** Carga un mapa id → Operario (para no consultar uno a uno). */
export async function cargarOperarios(base44) {
  const res = await base44.asServiceRole.entities.Operario.list('name', 1000);
  const items = Array.isArray(res) ? res : (res?.items || []);
  const map = {};
  items.forEach((o) => { map[o.id] = o; });
  return map;
}