import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * cargarCalendarioLaboral
 *
 * Carga en la entidad CalendarioLaboral las fiestas laborales de un año desde la
 * fuente OFICIAL de la Comunidad de Madrid (decreto del Consejo de Gobierno
 * publicado en el BOCM y resolución de la Dirección General de Trabajo en el BOE).
 *
 * Se ejecuta sola el 31 de diciembre para dejar preparado el año siguiente, y así
 * el cierre automático de fichajes y el calendario de ausencias lo usan desde el
 * 1 de enero sin tocar código.
 *
 * Reglas:
 *  · Solo fiestas nacionales y autonómicas vienen de la fuente oficial.
 *  · La fiesta LOCAL de la empresa es San Isidro (15 de mayo) por decisión interna,
 *    independiente de lo que publique el municipio.
 *  · Si el año aún no está publicado, se genera la estimación (fijos + Semana Santa
 *    + San Isidro) marcada como NO confirmada, para que administración la revise.
 *  · Solo corrige el año indicado. Nunca toca otros años ni los cierres de empresa
 *    (tipo 'empresa'), que se respetan.
 */

const FIJOS_NACIONALES = [
  ['01-01', 'Año Nuevo'],
  ['01-06', 'Epifanía del Señor'],
  ['05-01', 'Fiesta del Trabajo'],
  ['08-15', 'Asunción de la Virgen'],
  ['10-12', 'Fiesta Nacional de España'],
  ['11-01', 'Todos los Santos'],
  ['12-06', 'Día de la Constitución'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-25', 'Natividad del Señor'],
];

const FIESTA_LOCAL = { mesDia: '05-15', nombre: 'San Isidro Labrador' };

function domingoPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

/** Estimación determinista: fijos + Jueves/Viernes Santo + San Isidro. */
function calendarioEstimado(anio) {
  const mapa = new Map();
  for (const [mesDia, nombre] of FIJOS_NACIONALES) {
    mapa.set(`${anio}-${mesDia}`, { nombre, tipo: 'nacional' });
  }
  const pascua = domingoPascua(anio);
  const jueves = new Date(pascua);
  jueves.setUTCDate(pascua.getUTCDate() - 3);
  const viernes = new Date(pascua);
  viernes.setUTCDate(pascua.getUTCDate() - 2);
  mapa.set(aISO(jueves), { nombre: 'Jueves Santo', tipo: 'autonomico' });
  mapa.set(aISO(viernes), { nombre: 'Viernes Santo', tipo: 'nacional' });
  mapa.set(`${anio}-${FIESTA_LOCAL.mesDia}`, { nombre: FIESTA_LOCAL.nombre, tipo: 'local' });
  return mapa;
}

function fechaValida(fecha, anio) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  if (!fecha.startsWith(`${anio}-`)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Función de mantenimiento: solo administración, y siempre autenticada
    // (el workflow la invoca como el admin creador).
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'propietario', 'administracion'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo administración' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ahora = new Date();
    const anio = Number(body?.anio) || (ahora.getMonth() === 11 ? ahora.getFullYear() + 1 : ahora.getFullYear());
    if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
      return Response.json({ error: 'Año no válido' }, { status: 400 });
    }

    // 1) Fuente oficial: decreto del BOCM + resolución del BOE para ese año
    let publicado = false;
    let referencia = '';
    let oficiales = [];
    try {
      const respuesta = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_8_flash',
        add_context_from_internet: true,
        prompt: `Consulta el calendario laboral OFICIAL de la Comunidad de Madrid para el año ${anio}.

Fuentes válidas, por este orden:
1. El decreto del Consejo de Gobierno de la Comunidad de Madrid por el que se establecen las fiestas laborales del año ${anio}, publicado en el BOCM (boletín oficial, bocm.es).
2. La resolución de la Dirección General de Trabajo publicada en el BOE que recoge la relación de fiestas laborales del año ${anio}.

Devuelve SOLO las fiestas laborales de ámbito nacional y autonómico que figuren en esa norma (habitualmente doce). No incluyas las dos fiestas locales de cada municipio.

Indica en "ambito" si la fiesta es de ámbito nacional o autonómico. Indica en "referencia" el decreto o resolución concreto con su fecha y enlace.

Si el calendario de ${anio} todavía NO está publicado oficialmente, devuelve "publicado": false, la lista "festivos" vacía y en "referencia" el enlace o la norma del año anterior más reciente como referencia.`,
        response_json_schema: {
          type: 'object',
          properties: {
            publicado: { type: 'boolean', description: 'true si la norma oficial del año pedido ya está publicada' },
            referencia: { type: 'string', description: 'Norma oficial y enlace (BOCM/BOE)' },
            festivos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
                  nombre: { type: 'string', description: 'Nombre de la fiesta' },
                  ambito: { type: 'string', enum: ['nacional', 'autonomico'] },
                },
                required: ['fecha', 'nombre'],
              },
            },
          },
          required: ['publicado', 'festivos'],
        },
      });

      publicado = Boolean(respuesta?.publicado);
      referencia = typeof respuesta?.referencia === 'string' ? respuesta.referencia : '';
      oficiales = Array.isArray(respuesta?.festivos) ? respuesta.festivos : [];
    } catch (error) {
      oficiales = [];
      referencia = `No se pudo consultar la fuente oficial (${error.message}).`;
    }

    // 2) Construir el calendario objetivo
    const validos = oficiales.filter((f) => fechaValida(f?.fecha, anio));
    const usaOficial = publicado && validos.length >= 8;

    const objetivo = new Map();
    if (usaOficial) {
      for (const f of validos) {
        objetivo.set(f.fecha, {
          nombre: f.nombre || 'Festivo',
          tipo: f.ambito === 'autonomico' ? 'autonomico' : 'nacional',
        });
      }
    } else {
      for (const [fecha, datos] of calendarioEstimado(anio)) objetivo.set(fecha, datos);
    }

    // La fiesta local es decisión interna de la empresa, no de la fuente oficial
    objetivo.set(`${anio}-${FIESTA_LOCAL.mesDia}`, { nombre: FIESTA_LOCAL.nombre, tipo: 'local' });

    const fuente = usaOficial
      ? referencia || 'BOCM / BOE'
      : 'Sin publicación oficial localizada: calendario estimado, pendiente de revisar.';
    const nota = usaOficial
      ? `Cargado desde la fuente oficial. ${referencia}`.trim()
      : 'Generado automáticamente sin fuente oficial para este año. Revisar con el BOCM antes de usarlo como definitivo.';

    // 3) Volcar a la entidad sin duplicar y sin tocar cierres de empresa
    const existentes = await base44.asServiceRole.entities.CalendarioLaboral.filter({
      fecha: { $gte: `${anio}-01-01`, $lte: `${anio}-12-31` },
    });
    const porFecha = new Map(existentes.map((e) => [e.fecha, e]));

    const nuevos = [];
    const cambios = [];
    let conservados = 0;

    for (const [fecha, datos] of objetivo) {
      const existente = porFecha.get(fecha);
      const confirmado = datos.tipo === 'local' ? true : usaOficial;

      if (!existente) {
        nuevos.push({ fecha, ...datos, confirmado, activo: true, fuente, nota });
      } else if (existente.activo === false) {
        // Anulado a mano por administración: se respeta
        conservados++;
      } else {
        cambios.push({ id: existente.id, ...datos, confirmado, fuente });
      }
    }

    const sobrantes = existentes.filter((e) => !objetivo.has(e.fecha) && e.tipo !== 'empresa');

    if (nuevos.length) await base44.asServiceRole.entities.CalendarioLaboral.bulkCreate(nuevos);
    if (cambios.length) await base44.asServiceRole.entities.CalendarioLaboral.bulkUpdate(cambios);
    for (const e of sobrantes) {
      await base44.asServiceRole.entities.CalendarioLaboral.delete(e.id);
    }

    return Response.json({
      success: true,
      anio,
      origen: usaOficial ? 'oficial' : 'estimado',
      publicado,
      referencia,
      insertados: nuevos.length,
      actualizados: cambios.length,
      eliminados: sobrantes.length,
      conservados,
      total: objetivo.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}