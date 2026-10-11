import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Precisión de ciclo — re-examina los RegistroGasto de un periodo elegido,
// no solo los marcados precisa_precision al crearse. Identifica candidatos
// (faltan campos clave) y re-ejecuta OCR sobre el archivo ya guardado,
// devolviendo propuestas de relleno/corrección. NO aplica cambios: la
// gerencia/administración revisa y aplica desde el frontend.
//
// Acceso: gerencia, administracion, admin, propietario.

const SCHEMA = {
  type: 'object',
  properties: {
    nombre_comercio: { type: 'string' },
    nif_comercio: { type: 'string' },
    fecha_documento: { type: 'string' },
    hora_documento: { type: 'string' },
    importe: { type: 'number' },
    categoria: { type: 'string' },
    numero_factura: { type: 'string' },
    localidad: { type: 'string' },
    forma_pago_documento: { type: 'string' },
    codigo_validacion_fiscal: { type: 'string' },
    concepto: { type: 'string' },
    confianza: { type: 'number' },
  },
};

const PROMPT = `Analiza este ticket o factura y extrae TODOS los campos posibles, incluso si están parcialmente legibles. Esta es una pasada de precisión sobre un documento ya guardado: el objetivo es completar campos que faltan o corregir los que estén mal.
- fecha_documento YYYY-MM-DD, importe número, hora_documento HH:MM (24h, vacío si no aparece).
- categoria: material, combustible, peaje, parking, comida, otros.
- numero_factura, nif_comercio, localidad, forma_pago_documento, codigo_validacion_fiscal: extrae todo lo legible.
- confianza 0-1.
No inventes datos; si un campo no está en el documento, devuelve cadena vacía.`;

const CAMPOS_COMPARAR = ['numero_factura', 'nif_comercio', 'localidad', 'forma_pago_documento', 'codigo_validacion_fiscal', 'hora_documento', 'importe', 'fecha_documento'];
// Normaliza un valor según el campo: así una diferencia de FORMATO (hora 08:26 / 08:26:00,
// NIF con guion, mayúsculas, acentos) ya no se toma por una discrepancia real.
function normalizarCampo(campo, v) {
  const s = v == null ? '' : String(v).trim();
  if (!s) return '';
  switch (campo) {
    case 'nif_comercio': return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    case 'numero_factura':
    case 'codigo_validacion_fiscal': return s.toUpperCase().replace(/[\s\-_.]/g, '');
    case 'hora_documento': { const m = /(\d{1,2}):(\d{2})/.exec(s); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s; }
    case 'localidad':
    case 'forma_pago_documento': return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    case 'importe': return Number.isFinite(Number(s)) ? Number(s).toFixed(2) : s;
    default: return s;
  }
}
const LIMITE = 20;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rolesOk = ['admin', 'propietario', 'gerencia', 'administracion'];
    if (!rolesOk.includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo gerencia/administracion/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { inicio, fin, categoria, operario_id } = body;
    if (!inicio || !fin) return Response.json({ error: 'inicio y fin requeridos' }, { status: 400 });

    // 1. Candidatos: RegistroGasto del periodo con archivo y campos clave faltantes
    //    (o marcados precisa_precision), EXCLUYENDO los ya escaneados por esta
    //    función (precision_fecha con valor): si el documento sigue sin esos
    //    datos es porque el propio justificante no los tiene, no porque falte
    //    volver a analizarlo. Sin esta exclusión, "Analizar ciclo" devolvía
    //    siempre el mismo lote de 20 y nunca avanzaba al resto.
    const f = {
      fecha_documento: { $gte: inicio, $lte: fin },
      archivos: { $exists: true, $ne: [] },
      precision_fecha: { $in: [null, ''] },
      $or: [
        { precisa_precision: true },
        { numero_factura: { $in: [null, ''] } },
        { nif_comercio: { $in: [null, ''] } },
        { localidad: { $in: [null, ''] } },
        { codigo_validacion_fiscal: { $in: [null, ''] } },
      ],
    };
    if (categoria) f.categoria = categoria;
    if (operario_id) f.operario_id = operario_id;
    const candidatos = await base44.asServiceRole.entities.RegistroGasto.filter(f, '-updated_date', LIMITE);

    if (!candidatos.length) {
      return Response.json({ success: true, candidatos: [], total_candidatos: 0, procesados: 0, mensaje: 'No hay candidatos de precisión en el periodo (todos los documentos tienen los campos clave completos).' });
    }

    // 2. Re-ejecutar OCR sobre el archivo guardado, secuencial para no saturar.
    const resultados = [];
    for (const c of candidatos) {
      const url = c.archivos?.[0]?.url;
      if (!url) continue;
      let datos = null, error = null;
      try {
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: PROMPT,
          file_urls: [url],
          response_json_schema: SCHEMA,
        });
        datos = res && typeof res === 'object' ? res : (res?.output || null);
      } catch (e) {
        error = e?.message || 'Error InvokeLLM';
      }

      if (!datos) {
        resultados.push({
          id: c.id, numero_nota: c.numero_nota, nombre_comercio: c.nombre_comercio,
          fecha_documento: c.fecha_documento, importe: c.importe,
          operario_id: c.operario_id, operario_name: c.operario_name,
          estado: 'error', error, diffs: [], datos_propuestos: null,
        });
        continue;
      }

      // 3. Comparar campos: propuesta con valor que difiere o rellena un vacío.
           const diffs = [];
      for (const campo of CAMPOS_COMPARAR) {
        const actual = c[campo] == null ? '' : String(c[campo]);
        const prop = datos[campo] == null ? '' : String(datos[campo]);
        if (!prop) continue;
        if (campo === 'importe' && !Number.isFinite(Number(prop))) continue;
        if (normalizarCampo(campo, prop) === normalizarCampo(campo, actual)) continue; // mismo valor
        diffs.push({
          campo,
          actual: actual || '(vacío)',
          // hora e importe se proponen ya normalizados (HH:MM / 2 decimales)
          propuesto: (campo === 'hora_documento' || campo === 'importe') ? normalizarCampo(campo, prop) : prop,
        });
      }
      resultados.push({
        id: c.id, numero_nota: c.numero_nota, nombre_comercio: c.nombre_comercio,
        fecha_documento: c.fecha_documento, importe: c.importe, categoria: c.categoria,
        operario_id: c.operario_id, operario_name: c.operario_name,
        estado, diffs, datos_propuestos: datos, file_url: url,
      });
    }
    // 4. Marca TODOS los candidatos analizados para que no vuelvan a salir en el próximo lote:
    //    - confirmados: además se limpia precisa_precision (antes quedaban "pendientes" para siempre
    //      en el contador y en el semáforo de la página de gastos)
    //    - con error: se marcan como 'error' (antes reaparecían en cada análisis ocupando el lote)
    //    - con propuestas: se limpia precisa_precision cuando el usuario las aplica en el frontend
    if (resultados.length) {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.RegistroGasto.bulkUpdate(
        resultados.map(r => ({
          id: r.id,
          precision_fecha: now,
          precision_revisado_por: user.email,
          ...(r.estado === 'confirmado' ? { precisa_precision: false } : {}),
          ...(r.estado === 'error' ? { precision_modelo_usado: 'error' } : {}),
        }))
      );
    }
   
    const confirmados = resultados.filter(r => r.estado === 'confirmado').length;
    return Response.json({
      success: true,
      candidatos: resultados,
      total_candidatos: resultados.length,
      procesados: resultados.length,
      discrepancias,
      confirmados,
      limite: LIMITE,
      has_more: candidatos.length === LIMITE,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
