import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Precisión de multas — re-examina los MultaVehiculo de un periodo elegido
// (por fecha_multa), no solo los marcados volante_precision_revisado al crearse.
// Identifica candidatos con campos clave faltantes (hora, lugar, NIF autoridad,
// expediente, matrícula impresa) y re-ejecuta OCR sobre el volante_url ya
// guardado, devolviendo propuestas de relleno/corrección. NO aplica cambios:
// gerencia/administración revisa y aplica desde el frontend.
//
// Réplica exacta de precisionCiclo (Económico) adaptada a MultaVehiculo.
// Acceso: gerencia, administracion, admin, propietario.

const SCHEMA = {
  type: 'object',
  properties: {
    fecha_multa: { type: 'string', description: 'YYYY-MM-DD' },
    hora_multa: { type: 'string', description: 'HH:MM (24h). CRÍTICO.' },
    importe: { type: 'number' },
    autoridad: { type: 'string' },
    autoridad_nif: { type: 'string' },
    numero_expediente: { type: 'string' },
    lugar_infraccion: { type: 'string' },
    matricula_impresa: { type: 'string' },
    motivo: { type: 'string' },
    codigo_barras: { type: 'string' },
    confianza: { type: 'number' },
  },
};

const PROMPT = `Analiza este aviso o multa de vehículo y extrae TODOS los campos posibles, incluso si están parcialmente legibles. Esta es una pasada de precisión sobre un documento ya guardado: el objetivo es completar campos que faltan o corregir los que estén mal.
- fecha_multa YYYY-MM-DD, hora_multa HH:MM (24h, vacío si no aparece — pero ES CRÍTICO extraerla si está).
- importe número, autoridad (organismo emisor), autoridad_nif, numero_expediente.
- lugar_infraccion (calle/zona), matricula_impresa, motivo (texto literal), codigo_barras.
- confianza 0-1.
No inventes datos; si un campo no está en el documento, devuelve cadena vacía.`;

const CAMPOS_COMPARAR = [
  'hora_multa', 'lugar_infraccion', 'autoridad_nif', 'numero_expediente',
  'matricula_impresa', 'importe', 'fecha_multa', 'autoridad',
];

const LIMITE = 20;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rolesOk = ['admin', 'propietario', 'gerencia', 'administracion'];
    if (!rolesOk.includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo gerencia/administracion/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { inicio, fin, vehiculo_id } = body;
    if (!inicio || !fin) return Response.json({ error: 'inicio y fin requeridos' }, { status: 400 });

    // 1. Candidatos: MultaVehiculo del periodo con volante_url y campos clave
    //    faltantes, EXCLUYENDO los ya escaneados por esta función
    //    (volante_precision_fecha con valor): si el documento sigue sin esos
    //    datos es porque el volante no los tiene, no porque falte analizarlo.
    const f = {
      fecha_multa: { $gte: inicio, $lte: fin },
      volante_url: { $exists: true, $ne: '' },
      volante_precision_fecha: { $in: [null, ''] },
      $or: [
        { volante_ocr_procesado: { $in: [null, false] } },
        { hora_multa: { $in: [null, ''] } },
        { lugar_infraccion: { $in: [null, ''] } },
        { autoridad_nif: { $in: [null, ''] } },
        { numero_expediente: { $in: [null, ''] } },
        { matricula_impresa: { $in: [null, ''] } },
      ],
    };
    if (vehiculo_id) f.vehiculo_id = vehiculo_id;
    const candidatos = await base44.asServiceRole.entities.MultaVehiculo.filter(f, '-updated_date', LIMITE);

    if (!candidatos.length) {
      return Response.json({
        success: true, candidatos: [], total_candidatos: 0, procesados: 0,
        mensaje: 'No hay candidatos de precisión en el periodo (todos los volantes tienen los campos clave completos o ya fueron escaneados).',
      });
    }

    // 2. Re-ejecutar OCR sobre el volante guardado, secuencial para no saturar.
    const resultados = [];
    for (const c of candidatos) {
      const url = c.volante_url;
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
          id: c.id,
          vehiculo_matricula: c.vehiculo_matricula,
          autoridad: c.autoridad,
          fecha_multa: c.fecha_multa,
          importe: c.importe,
          estado: 'error', error, diffs: [], datos_propuestos: null,
        });
        continue;
      }

      // 3. Comparar campos: propuesta con valor que difiere o rellena un vacío.
      const diffs = [];
      for (const campo of CAMPOS_COMPARAR) {
        const actual = c[campo] == null ? '' : String(c[campo]);
        let prop = datos[campo];
        if (prop == null) prop = '';
        if (campo === 'importe') {
          prop = prop === '' ? '' : String(Number(prop).toFixed(2));
          if (actual !== '') {
            prop = Number(prop).toFixed(2) === Number(actual).toFixed(2) ? '' : prop;
          }
        }
        prop = String(prop);
        if (prop && prop !== actual) {
          diffs.push({ campo, actual: actual || '(vacío)', propuesto: prop });
        }
      }
      const estado = diffs.length ? 'discrepancia' : 'confirmado';
      resultados.push({
        id: c.id,
        vehiculo_matricula: c.vehiculo_matricula,
        autoridad: c.autoridad,
        fecha_multa: c.fecha_multa,
        importe: c.importe,
        estado,
        diffs,
        datos_propuestos: datos,
        file_url: url,
      });
    }

    // 4. Marca TODOS los candidatos analizados (confirmados, con propuestas o
    //    con error) como escaneados, para que no vuelvan a salir en el próximo
    //    lote aunque sus campos sigan vacíos (el volante no tiene esos datos).
    const idsEscaneados = resultados.filter(r => r.estado !== 'error').map(r => r.id);
    if (idsEscaneados.length) {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.MultaVehiculo.bulkUpdate(
        idsEscaneados.map(id => ({
          id,
          volante_precision_fecha: now,
          volante_precision_revisado_por: user.email,
        }))
      );
    }

    const discrepancias = resultados.filter(r => r.estado === 'discrepancia').length;
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