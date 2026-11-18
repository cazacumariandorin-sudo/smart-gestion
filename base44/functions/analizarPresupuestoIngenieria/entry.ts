import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * analizarPresupuestoIngenieria — Fase 2 del flujo de presupuestos.
 *
 * Analiza las partidas del presupuesto junto con la documentación de obra
 * cargada en Ingeniería y propone un precio por partida con desglose interno:
 * materiales, mano de obra (horas × coste/hora de la empresa), dietas y
 * desplazamiento. Los cálculos económicos se hacen aquí (deterministas);
 * la IA solo interpreta alcance, materiales y horas.
 *
 * La IA nunca inventa mediciones ni costes: lo que no consta se devuelve en
 * `datos_no_disponibles`. El resultado es una propuesta editable.
 */

const ROLES_INTERNOS = ['admin', 'propietario', 'gerencia', 'director_comercial', 'administracion'];
const n0 = (v) => Math.max(0, Number(v) || 0);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const SCHEMA = {
  type: 'object',
  properties: {
    alcance: { type: 'string', description: 'Alcance de los trabajos presupuestados' },
    mediciones: { type: 'array', items: { type: 'string' }, description: 'Mediciones y cálculos detectados en la documentación' },
    partidas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          indice: { type: 'number', description: 'Índice de la línea del presupuesto (el que se te da en la lista)' },
          horas_estimadas: { type: 'number', description: 'Horas de un técnico para ejecutar la partida completa' },
          coste_materiales: { type: 'number', description: 'Coste de materiales de la partida en euros. 0 si no hay datos' },
          dias_dieta: { type: 'number', description: 'Días de estancia necesarios. 0 si no aplica' },
          trabajadores_dieta: { type: 'number', description: 'Nº de trabajadores que pernoctan. 0 si no aplica' },
          desplazamiento_importe: { type: 'number', description: 'Coste estimado de desplazamiento en euros. 0 si no aplica' },
          supuesto: { type: 'string', description: 'Supuesto aplicado al valorar esta partida' },
        },
      },
    },
    materiales_agrupados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          grupo: { type: 'string', description: 'Tipo de material o maquinaria' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descripcion: { type: 'string' },
                cantidad: { type: 'number' },
                unidad: { type: 'string' },
                coste_estimado: { type: 'number' },
              },
            },
          },
        },
      },
    },
    supuestos: { type: 'array', items: { type: 'string' } },
    datos_no_disponibles: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'number' },
  },
};

function textoDocumentos(docs) {
  return docs.map((d, i) => {
    const datos = d.datos_extraidos ? JSON.stringify(d.datos_extraidos).slice(0, 1200) : '';
    return `Documento ${i + 1} (${d.tipo || 'obra'}${d.revision ? ` rev. ${d.revision}` : ''}): ${datos || 'sin datos extraídos'}`;
  }).join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_INTERNOS.includes(user.role)) {
      return Response.json({ error: 'El análisis interno de precios está reservado a dirección, gerencia y administración.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const conceptos = Array.isArray(body.conceptos) ? body.conceptos : [];
    // Las líneas de solo texto (cabeceras) no se valoran, pero conservan su índice original
    const valorables = conceptos.map((c, i) => ({ c, i })).filter(({ c }) => c && c.tipo !== 'texto');
    if (valorables.length === 0) return Response.json({ error: 'El presupuesto no tiene partidas que analizar' }, { status: 400 });

    const margenPct = Math.max(0, Number(body.margen_pct ?? 25));
    const sr = base44.asServiceRole;

    const [empresasRaw, condicionesRaw, docsRaw] = await Promise.all([
      sr.entities.Empresa.list().catch(() => []),
      body.cliente_id ? sr.entities.CondicionesEconomicas.filter({ client_id: body.cliente_id }).catch(() => []) : Promise.resolve([]),
      body.obra_id
        ? sr.entities.MaterialDocumentoOrigen.filter({ obra_id: body.obra_id }, '-created_date', 20).catch(() => [])
        : Promise.resolve([]),
    ]);

    const empresas = Array.isArray(empresasRaw) ? empresasRaw : [];
    const empresa = empresas.find((e) => e.es_principal) || empresas.find((e) => e.activa !== false) || empresas[0] || null;
    const revisiones = Array.isArray(empresa?.coste_laboral_revisiones) ? empresa.coste_laboral_revisiones : [];
    const revision = empresa?.coste_laboral_revision_actual?.estado === 'aprobado'
      ? empresa.coste_laboral_revision_actual
      : [...revisiones].filter((r) => r.estado === 'aprobado').sort((a, b) => new Date(b.fecha_revision || 0) - new Date(a.fecha_revision || 0))[0] || null;
    const costeDiario = revision && revision.coste_diario > 0 ? Number(revision.coste_diario) : null;
    const horasJornada = n0(revision?.horas_jornada) || 8;

    const condiciones = Array.isArray(condicionesRaw) ? condicionesRaw : [];
    const condicion = condiciones.find((c) => c.obra_id && c.obra_id === body.obra_id) || condiciones.find((c) => !c.obra_id) || condiciones[0] || null;
    const alojamientoDia = n0(condicion?.alojamiento_dia_trabajador) || 100;
    const precioHoraCliente = n0(condicion?.precio_hora) || 40;

    let costeHora = null;
    let fuenteCosteHora = 'sin_datos';
    if (costeDiario) { costeHora = r2(costeDiario / horasJornada); fuenteCosteHora = 'coste_interno'; }
    else if (precioHoraCliente) { costeHora = precioHoraCliente; fuenteCosteHora = 'tarifa_cliente'; }

    const docs = (Array.isArray(docsRaw) ? docsRaw : []).slice(0, 8);

    const listaPartidas = valorables.map(({ c, i }) => (
      `${i}. [${c.unidad || 'ud'}] ${n0(c.cantidad) || 1} × ${c.descripcion || ''}${c.detalle ? ` — ${c.detalle}` : ''}`
    )).join('\n');

    const prompt = `Eres el jefe técnico de una empresa de instalaciones y obra (Simantec). Debes preparar un ANÁLISIS INTERNO de un presupuesto: estimar el coste real de cada partida para que la dirección decida el precio final.

DATOS DEL TRABAJO
Cliente: ${body.cliente_name || 'No indicado'}
Obra: ${body.obra_name || 'No indicada'}
Coste de la hora de trabajo: ${costeHora ? `${costeHora} €/h` : 'sin datos'} (${fuenteCosteHora})
Alojamiento por trabajador y día: ${alojamientoDia} €

PARTIDAS DEL PRESUPUESTO (índice. [unidad] cantidad × descripción)
${listaPartidas}

DOCUMENTACIÓN DE OBRA DISPONIBLE EN INGENIERÍA
${docs.length ? textoDocumentos(docs) : 'No hay documentación de obra cargada para esta obra.'}

REGLAS OBLIGATORIAS
- Devuelve una entrada por CADA índice de la lista, con su mismo índice. No añadas ni omitas índices.
- horas_estimadas: horas de un técnico para ejecutar la partida completa (no por unidad).
- coste_materiales: coste real de materiales en euros. Solo a partir de la documentación o de materiales descritos en la partida. Si no hay base para valorarlo, 0 y explícalo en supuesto.
- dias_dieta y trabajadores_dieta: solo si la documentación o la obra implican pernocta. Si no, 0.
- desplazamiento_importe: coste estimado de desplazamiento si procede. Si no, 0.
- NO devuelvas precios de venta ni márgenes: eso se calcula después.
- NO inventes mediciones ni materiales que no consten. Lo que falte va en datos_no_disponibles.
- materiales_agrupados: agrupa los materiales por tipo o maquinaria (cable, cuadro eléctrico, estructura, ferretería...), con su coste estimado.
- En supuestos explica cada decisión de valoración; en datos_no_disponibles lo que la documentación no permite determinar.
- confianza: 0-1 sobre la calidad de la valoración.`;

    const respuesta = await sr.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
    });
    const ia = respuesta && typeof respuesta === 'object' ? respuesta : null;
    if (!ia) return Response.json({ error: 'La IA no devolvió ningún análisis' }, { status: 502 });

    const porIndice = new Map((ia.partidas || []).map((p) => [Number(p.indice), p]));
    const partidas = conceptos.map((c, i) => {
      if (!c || c.tipo === 'texto') {
        return {
          indice: i, descripcion: String(c?.descripcion || ''), cantidad: 0, unidad: '',
          horas_estimadas: 0, coste_materiales: 0, coste_mano_obra: 0, dietas: 0, desplazamiento: 0,
          coste_total: 0, precio_sugerido: 0, supuesto: 'Línea de texto: no se valora',
        };
      }
      const est = porIndice.get(i) || {};
      const horas = n0(est.horas_estimadas);
      const costeMateriales = r2(n0(est.coste_materiales));
      const costeManoObra = costeHora ? r2(horas * costeHora) : 0;
      const dietas = r2(n0(est.dias_dieta) * n0(est.trabajadores_dieta) * alojamientoDia);
      const desplazamiento = r2(n0(est.desplazamiento_importe));
      const costeTotal = r2(costeMateriales + costeManoObra + dietas + desplazamiento);
      return {
        indice: i,
        descripcion: String(c.descripcion || ''),
        cantidad: n0(c.cantidad) || 1,
        unidad: c.unidad || 'ud',
        horas_estimadas: horas,
        coste_materiales: costeMateriales,
        coste_mano_obra: costeManoObra,
        dietas,
        desplazamiento,
        coste_total: costeTotal,
        precio_sugerido: r2(costeTotal * (1 + margenPct / 100)),
        supuesto: String(est.supuesto || ''),
      };
    });

    const desglose = {
      materiales: r2(partidas.reduce((s, p) => s + p.coste_materiales, 0)),
      mano_obra: r2(partidas.reduce((s, p) => s + p.coste_mano_obra, 0)),
      dietas: r2(partidas.reduce((s, p) => s + p.dietas, 0)),
      desplazamiento: r2(partidas.reduce((s, p) => s + p.desplazamiento, 0)),
    };
    desglose.coste_total = r2(desglose.materiales + desglose.mano_obra + desglose.dietas + desglose.desplazamiento);

    const datosNoDisponibles = Array.isArray(ia.datos_no_disponibles) ? [...ia.datos_no_disponibles] : [];
    if (!costeDiario) {
      datosNoDisponibles.push('No hay coste diario aprobado en la ficha de empresa: la mano de obra se ha valorado con la tarifa del cliente.');
    }

    const informe = {
      presupuesto_id: body.presupuesto_id || '',
      presupuesto_codigo: body.presupuesto_codigo || '',
      cliente_name: body.cliente_name || '',
      obra_name: body.obra_name || '',
      alcance: String(ia.alcance || ''),
      mediciones: Array.isArray(ia.mediciones) ? ia.mediciones : [],
      materiales_agrupados: Array.isArray(ia.materiales_agrupados) ? ia.materiales_agrupados : [],
      partidas,
      desglose,
      totales: {
        coste_interno: desglose.coste_total,
        precio_propuesto: r2(desglose.coste_total * (1 + margenPct / 100)),
        margen_importe: r2(desglose.coste_total * (margenPct / 100)),
        margen_pct: margenPct,
      },
      horas_totales: r2(partidas.reduce((s, p) => s + p.horas_estimadas, 0)),
      coste_hora_interno: costeHora || 0,
      coste_diario_aprobado: costeDiario || 0,
      fuente_coste_hora: fuenteCosteHora,
      supuestos: Array.isArray(ia.supuestos) ? ia.supuestos : [],
      datos_no_disponibles: datosNoDisponibles,
      confianza: Number(ia.confianza) || 0,
      generado_por: user.email || user.full_name || '',
      generado_en: new Date().toISOString(),
      version: 1,
      estado: 'borrador',
    };

    return Response.json({
      ok: true,
      partidas,
      informe,
      base: { coste_hora: costeHora, coste_diario: costeDiario, alojamiento_dia: alojamientoDia, precio_hora_cliente: precioHoraCliente, margen_pct: margenPct, fuente_coste_hora: fuenteCosteHora, documentos: docs.length },
    });
  } catch (error) {
    console.error('analizarPresupuestoIngenieria:', error);
    return Response.json({ error: error?.message || 'No se pudo analizar el presupuesto' }, { status: 500 });
  }
}