import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * analizarSeguimientoObra — análisis de respaldo del seguimiento de una obra.
 *
 * Reúne las fuentes operativas de la obra (fotos, partes, documentos, materiales
 * pendientes, fichajes, previsiones, presupuestos y discrepancias) y pide a la IA
 * observaciones de avance, posibles incidencias y posibles trabajos extra.
 *
 * Reglas del análisis:
 * - Cada observación se vincula a registros concretos (entidad + id) leídos aquí.
 * - La IA nunca aporta URLs, fechas ni importes: se resuelven con los registros.
 * - Una observación sin evidencia se degrada a "pendiente" (no se afirma nada).
 * - Nada se considera confirmado: el estado de revisión es siempre humano.
 */

const ROLES_INTERNOS = [
  'admin',
  'propietario',
  'gerencia',
  'administracion',
  'director_comercial',
  'ingeniero',
  'jefe_obra',
];

const PESTANA_POR_ENTIDAD = {
  parte: 'informes',
  documento: 'informes',
  material: 'materiales',
  presupuesto: 'materiales',
  foto: 'fotos',
  fichaje: 'horas',
  prevision: 'horas',
  discrepancia: 'discrepancias',
};

const SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: 'Resumen del estado del seguimiento en 3-6 frases' },
    hallazgos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          seccion: { type: 'string', enum: ['avance', 'incidencia', 'trabajo_extra'] },
          titulo: { type: 'string', description: 'Titular corto de la observación' },
          detalle: { type: 'string', description: 'Qué se observa y con qué datos' },
          tipo: { type: 'string', enum: ['hecho', 'inferencia', 'pendiente'] },
          confianza: { type: 'number', description: '0-1' },
          evidencias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entidad: { type: 'string', description: 'parte | documento | material | presupuesto | foto | fichaje | prevision | discrepancia' },
                registro_id: { type: 'string', description: 'ID exacto tomado de la lista de datos' },
                etiqueta: { type: 'string', description: 'Texto breve de referencia' },
              },
              required: ['entidad', 'registro_id'],
            },
          },
        },
        required: ['seccion', 'titulo', 'tipo'],
      },
    },
    datos_no_disponibles: { type: 'array', items: { type: 'string' } },
    recomendaciones: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'number', description: '0-1' },
  },
  required: ['resumen', 'hallazgos'],
};

const txt = (valor, max = 400) =>
  String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const fecha = (valor) => (valor ? String(valor).slice(0, 10) : '');

const esImagen = (url) =>
  typeof url === 'string' && /^https?:\/\//i.test(url) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);

const numero = (valor, max = 1) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, n));
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_INTERNOS.includes(user.role)) {
      return Response.json(
        { error: 'El análisis de seguimiento está reservado a dirección, gerencia, administración e ingeniería.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const obraId = String(body.obra_id || '').trim();
    if (!obraId) return Response.json({ error: 'obra_id es obligatorio' }, { status: 400 });

    const sr = base44.asServiceRole;

    const obraCivil = await sr.entities.Obra.get(obraId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    const obraSolar = obraCivil
      ? null
      : await sr.entities.SolarObra.get(obraId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    const obra = obraCivil || obraSolar;
    if (!obra) return Response.json({ error: 'No se ha encontrado la obra' }, { status: 404 });

    const fallos = [];
    const seguro = async (nombre, fn) => {
      try {
        const r = await fn();
        return Array.isArray(r) ? r : r?.items || [];
      } catch {
        fallos.push(nombre);
        return [];
      }
    };

    const [materiales, partes, fotosRaw, documentos, fichajes, previsiones, presupuestosObra, discrepancias] =
      await Promise.all([
        seguro('materiales pendientes', () => sr.entities.MaterialPendiente.filter({ obra_id: obraId }, '-fecha_solicitud', 200)),
        seguro('partes diarios', () => sr.entities.ParteDiarioObra.filter({ obra_id: obraId }, '-fecha', 60)),
        seguro('fotos', () => sr.entities.FotoProyecto.filter({ proyecto_id: obraId }, '-fecha_foto', 60)),
        seguro('documentos', () => sr.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: obraId }, '-created_date', 40)),
        seguro('fichajes', () => sr.entities.Fichaje.filter({ obra_id: obraId }, '-date', 200)),
        seguro('previsiones', () => sr.entities.PrevisionObra.filter({ obra_id: obraId }, '-fecha_inicio', 50)),
        seguro('presupuestos', () => sr.entities.Presupuesto.filter({ obra_id: obraId }, '-fecha', 40)),
        seguro('discrepancias', () => sr.entities.Discrepancia.filter({ obra_id: obraId }, '-created_date', 60)),
      ]);

    // Presupuestos del mismo cliente aún sin obra asignada: también son de este proyecto
    const cliente = String(obra.client_name || '').trim();
    let presupuestosCliente = [];
    if (cliente) {
      presupuestosCliente = await seguro('presupuestos del cliente', () =>
        sr.entities.Presupuesto.filter({ cliente_name: cliente }, '-fecha', 40)
      );
    }
    const vistos = new Set(presupuestosObra.map((p) => p.id));
    const presupuestos = [...presupuestosObra, ...presupuestosCliente.filter((p) => !vistos.has(p.id) && !p.obra_id)];

    const fotos = fotosRaw.filter((f) => !f.eliminada);

    // Índice de evidencias: solo se aceptan referencias a registros que existen aquí
    const indice = new Map();
    const registrar = (entidad, registro, etiqueta, fechaReg, url) => {
      if (!registro?.id) return;
      indice.set(`${entidad}:${registro.id}`, {
        entidad,
        registro_id: registro.id,
        etiqueta: txt(etiqueta, 160),
        fecha: fechaReg || '',
        url: url || '',
        pestana: PESTANA_POR_ENTIDAD[entidad] || 'resumen',
      });
    };

    partes.forEach((p) => registrar('parte', p, `Parte ${fecha(p.fecha)}${p.tecnico_name ? ` · ${p.tecnico_name}` : ''}`, fecha(p.fecha)));
    materiales.forEach((m) => registrar('material', m, m.descripcion, fecha(m.fecha_solicitud)));
    documentos.forEach((d) => registrar('documento', d, `${d.tipo || 'Documento'}${d.numero_documento ? ` ${d.numero_documento}` : ''}`, fecha(d.fecha_documento || d.created_date)));
    presupuestos.forEach((p) => registrar('presupuesto', p, p.titulo || p.codigo_registro || 'Presupuesto', fecha(p.fecha)));
    fotos.forEach((f) => registrar('foto', f, f.titulo || f.descripcion || 'Foto de obra', fecha(f.fecha_foto), f.foto_url));
    fichajes.forEach((f) => registrar('fichaje', f, `Fichaje ${fecha(f.date)} · ${f.operario_name || ''}`, fecha(f.date)));
    previsiones.forEach((p) => registrar('prevision', p, `Previsión ${fecha(p.fecha_inicio)} → ${fecha(p.fecha_fin)}`, fecha(p.fecha_inicio)));
    discrepancias.forEach((d) => registrar('discrepancia', d, d.descripcion || d.tipo || 'Discrepancia', fecha(d.created_date)));

    const horasTotales = fichajes.reduce((s, f) => s + (Number(f.horas_trabajadas) || 0), 0);
    const materialesPendientes = materiales.filter((m) => (m.estado || 'pendiente') !== 'recibido');
    const fotosVision = fotos.filter((f) => esImagen(f.foto_url)).slice(0, 6);
    const fileUrls = fotosVision.map((f) => f.foto_url);
    const idsVision = new Set(fotosVision.map((f) => f.id));

    const lineas = (titulo, items) => `${titulo}${items.length ? `\n${items.join('\n')}` : ': sin registros'}`;

    const digest = [
      lineas(
        'PREVISIONES',
        previsiones.map(
          (p) =>
            `- [prevision ${p.id}] ${fecha(p.fecha_inicio)} → ${fecha(p.fecha_fin)} · ${p.status || 'sin estado'} · ${Number(p.horas_totales_previstas) || 0} h previstas · ${Number(p.horas_reales_acumuladas) || 0} h reales · semáforo ${p.status_semaforo || 'sin datos'}`
        )
      ),
      lineas(
        'PARTES DIARIOS (más recientes primero)',
        partes.slice(0, 20).map(
          (p) =>
            `- [parte ${p.id}] ${fecha(p.fecha)} · ${p.tecnico_name || 'sin técnico'} · ${p.estado || 'borrador'} · realizados: ${txt(p.trabajos_realizados, 300) || 'sin detalle'} · pendientes: ${txt(p.trabajos_pendientes, 180) || 'sin detalle'} · materiales citados: ${txt(p.materiales_necesarios, 150) || 'sin detalle'}`
        )
      ),
      lineas(
        'MATERIALES PENDIENTES',
        materiales.slice(0, 30).map(
          (m) => `- [material ${m.id}] ${fecha(m.fecha_solicitud)} · ${m.estado || 'pendiente'} · ${txt(m.descripcion, 200)}`
        )
      ),
      lineas(
        'DOCUMENTOS DE INGENIERÍA',
        documentos.slice(0, 15).map(
          (d) => `- [documento ${d.id}] ${d.tipo || 'documento'}${d.numero_documento ? ` ${d.numero_documento}` : ''} · ${d.revision ? `rev. ${d.revision} · ` : ''}${d.estado || 'sin estado'}`
        )
      ),
      lineas(
        'PRESUPUESTOS',
        presupuestos.slice(0, 12).map(
          (p) =>
            `- [presupuesto ${p.id}] ${p.codigo_registro || 'sin código'} · ${p.titulo || 'sin título'} · ${p.estado || 'borrador'} · ${Number(p.importe) || 0} €${!p.obra_id ? ' · sin obra asignada' : ''}`
        )
      ),
      lineas(
        'FOTOS',
        fotos.slice(0, 25).map(
          (f) =>
            `- [foto ${f.id}] ${fecha(f.fecha_foto)} · ${txt(f.titulo || f.descripcion, 140) || 'sin descripción'} · ${f.validada ? 'validada' : 'sin validar'}${idsVision.has(f.id) ? ' · imagen adjunta al análisis' : ''}`
        )
      ),
      lineas(
        'FICHAJES',
        [`Total registrado: ${horasTotales.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h en ${fichajes.length} fichaje(s)`].concat(
          fichajes.slice(0, 10).map(
            (f) => `- [fichaje ${f.id}] ${fecha(f.date)} · ${f.operario_name || 'sin nombre'} · ${Number(f.horas_trabajadas) || 0} h · ${f.obra_name || ''}`
          )
        )
      ),
      lineas(
        'DISCREPANCIAS',
        discrepancias.slice(0, 15).map(
          (d) => `- [discrepancia ${d.id}] ${txt(d.descripcion, 200) || 'sin descripción'} · ${d.tipo || ''} · ${d.estado || ''}`
        )
      ),
    ].join('\n\n');

    const prompt = `Eres el jefe de obra de Simantec y revisas el seguimiento de un proyecto de instalaciones. Debes preparar un INFORME DE RESPALDO del avance a partir SOLO de los registros que se listan abajo.

OBRA
Nombre: ${obra.name || obra.obra_name || obra.nombre || 'sin nombre'}
Código / nº proyecto: ${obra.numero_proyecto || obra.code || 'sin código'}
Cliente: ${obra.client_name || 'no indicado'}
Dirección: ${obra.address || obra.direccion || 'no indicada'}
Estado: ${obra.estado_ingenieria || obra.status || 'sin estado'}
Fechas: ${fecha(obra.start_date)} → ${fecha(obra.end_date)}

DATOS REGISTRADOS DE LA OBRA (cada línea empieza por [entidad ID])
${digest || 'No hay registros asociados a esta obra.'}

CÓMO DEBES RESPONDER
1. Cada observación debe citar en "evidencias" los registros concretos en los que se apoya, usando el ID exacto entre corchetes. Nunca inventes IDs, fechas, importes ni materiales.
2. Clasifica cada observación:
   - "hecho": consta literalmente en un registro (un parte describe ese trabajo, un material está pendiente, una foto está validada...).
   - "inferencia": deducción razonada a partir de varios registros (ritmo de avance, desviación de horas, material no citado en el presupuesto...).
   - "pendiente": no hay datos suficientes para afirmarlo.
3. Sección "avance": qué se ha ejecutado y con qué respaldo (partes, fotos, horas).
4. Sección "incidencia": posibles fallos, retrasos, desviaciones de horas, materiales pendientes críticos, discrepancias sin cerrar, falta de fotos o partes.
5. Sección "trabajo_extra": solo si hay indicios de trabajos no previstos (partes que describen algo que no aparece en el presupuesto, materiales solicitados que no constan en ninguna partida, extras registrados).
6. Sobre las fotos: describe únicamente lo que se observa. NUNCA afirmes que una imagen demuestra un defecto o un trabajo terminado; como máximo indícalo como "inferencia" y pide verificación en obra.
7. No valores económicamente nada ni propongas precios.
8. Máximo 12 observaciones en total. Si no hay datos, dilo en "datos_no_disponibles" y devuelve pocas observaciones.
9. "confianza" global entre 0 y 1 según la cantidad y calidad de registros disponibles.`;

    let respuesta;
    try {
      respuesta = await sr.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: SCHEMA,
        file_urls: fileUrls.length ? fileUrls : undefined,
      });
    } catch {
      // Si alguna imagen no es accesible para el modelo, se repite el análisis solo con texto
      respuesta = await sr.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });
    }
    const ia = respuesta && typeof respuesta === 'object' ? respuesta : null;
    if (!ia) return Response.json({ error: 'La IA no devolvió ningún análisis' }, { status: 502 });

    const SECCIONES = ['avance', 'incidencia', 'trabajo_extra'];
    const TIPOS = ['hecho', 'inferencia', 'pendiente'];

    const hallazgos = (Array.isArray(ia.hallazgos) ? ia.hallazgos : []).slice(0, 20).map((h, i) => {
      const evidencias = (Array.isArray(h.evidencias) ? h.evidencias : [])
        .map((e) => indice.get(`${e?.entidad}:${e?.registro_id}`))
        .filter(Boolean);
      const tipoOriginal = TIPOS.includes(h.tipo) ? h.tipo : 'inferencia';
      // Sin evidencia no se puede afirmar nada: la observación queda pendiente de verificar
      const sinEvidencia = evidencias.length === 0;
      return {
        id: `h-${i + 1}`,
        seccion: SECCIONES.includes(h.seccion) ? h.seccion : 'avance',
        titulo: txt(h.titulo, 200) || 'Observación',
        detalle: txt(h.detalle, 1200),
        tipo: sinEvidencia ? 'pendiente' : tipoOriginal,
        confianza: numero(h.confianza),
        sin_evidencia: sinEvidencia,
        evidencias,
        estado_revision: 'pendiente',
        nota_revision: '',
      };
    });

    const datosNoDisponibles = (Array.isArray(ia.datos_no_disponibles) ? ia.datos_no_disponibles : [])
      .map((d) => txt(d, 300))
      .filter(Boolean);
    fallos.forEach((f) => datosNoDisponibles.push(`No se pudieron leer ${f} en este momento.`));
    if (fotosVision.length === 0) {
      datosNoDisponibles.push('No hay fotos accesibles para el análisis visual: el avance se valora solo con registros.');
    }
    if (!previsiones.length) {
      datosNoDisponibles.push('La obra no tiene previsión de horas: no se puede medir desviación de avance.');
    }

    const fuentes = [
      { entidad: 'parte', etiqueta: 'Partes diarios', registros: partes.length },
      { entidad: 'foto', etiqueta: 'Fotos', registros: fotos.length },
      { entidad: 'material', etiqueta: 'Material pendiente', registros: materiales.length },
      { entidad: 'documento', etiqueta: 'Documentos', registros: documentos.length },
      { entidad: 'fichaje', etiqueta: 'Fichajes', registros: fichajes.length },
      { entidad: 'prevision', etiqueta: 'Previsiones', registros: previsiones.length },
      { entidad: 'presupuesto', etiqueta: 'Presupuestos', registros: presupuestos.length },
      { entidad: 'discrepancia', etiqueta: 'Discrepancias', registros: discrepancias.length },
    ];

    const analisis = await sr.entities.AnalisisSeguimientoObra.create({
      obra_id: obraId,
      obra_name: obra.name || obra.obra_name || obra.nombre || '',
      obra_tipo: body.obra_tipo === 'solar' || obraSolar ? 'solar' : 'obra_civil',
      codigo_obra: obra.numero_proyecto || obra.code || '',
      resumen: txt(ia.resumen, 2000),
      hallazgos,
      datos_no_disponibles: datosNoDisponibles,
      recomendaciones: (Array.isArray(ia.recomendaciones) ? ia.recomendaciones : []).map((r) => txt(r, 300)).filter(Boolean),
      fuentes,
      fotos_analizadas: fotosVision.length,
      confianza: numero(ia.confianza),
      generado_por: user.email || '',
      generado_por_nombre: user.full_name || user.email || '',
      generado_en: new Date().toISOString(),
      estado: 'borrador',
    });

    return Response.json({ ok: true, analisis, materiales_pendientes: materialesPendientes.length });
  } catch (error) {
    console.error('analizarSeguimientoObra:', error);
    return Response.json({ error: error?.message || 'No se pudo analizar el seguimiento' }, { status: 500 });
  }
}