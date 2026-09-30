import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  GASTO_OCR_SCHEMA_MULTI, PROMPT_OCR_MULTI, PROMPT_OCR_PRECISION, procesarResultadoMulti,
} from '../../shared/ocrGastosConfig.ts';

// Re-OCR multi-ticket de un RegistroGasto con varias fotos (registro mal creado:
// un solo importe para N justificantes). Re-procesa CADA foto con el flujo
// multi-ticket y crea un RegistroGasto nuevo por cada ticket detectado, con ESA
// foto como su único archivo. Anula el registro original (estado 'rechazada')
// dejándolo como auditoría. Devuelve el resumen de la reconstrucción.
//
// Caso típico: un técnico subió 19 tickets de parking como "páginas" de un
// único gasto; el flujo antiguo colapsó todo en 1 registro con un importe.
// Esta herramienta deshace ese error y crea los registros reales.
//
// Acceso: gerencia, administracion, admin, propietario.
// Entrada: { registro_id, precision?: boolean }
//   precision=true → usa modelo gemini_3_flash (alta precisión, ~5 créditos/foto)
//   precision=false (default) → modelo automático (~1 crédito/foto)
// Salida: { success, registro_original_id, registros_creados[], total_creados, total_omitidos, errores[] }

const ROLES_OK = ['admin', 'propietario', 'gerencia', 'administracion'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_OK.includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo gerencia/administracion/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { registro_id, precision = false } = body;
    if (!registro_id) return Response.json({ error: 'registro_id requerido' }, { status: 400 });

    const original = await base44.asServiceRole.entities.RegistroGasto.get(registro_id);
    if (!original) return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
    const archivos = Array.isArray(original.archivos) ? original.archivos.filter(a => a?.url) : [];
    if (archivos.length === 0) {
      return Response.json({ error: 'El registro no tiene fotos adjuntas que re-procesar' }, { status: 400 });
    }

    const registrosCreados = [];
    const errores = [];
    let secuenciaBase = 0;

    // Calcular siguiente numero_secuencia para repartir entre los nuevos
    // (usa el contador del operario: mayor numero_secuencia existente + 1)
    const existentes = await base44.asServiceRole.entities.RegistroGasto.filter(
      { operario_id: original.operario_id },
      '-numero_secuencia',
      1,
      { fields: ['numero_secuencia'] },
    );
    const arr = Array.isArray(existentes) ? existentes : (existentes?.items || []);
    let siguienteSec = (arr[0]?.numero_secuencia || 0) + 1;

    for (const archivo of archivos) {
      const fileUrl = archivo.url;
      // 1. OCR multi-ticket sobre esta foto
      let resultado = null;
      let ocrError = null;
      try {
        const invokeArgs = {
          prompt: precision ? PROMPT_OCR_PRECISION : PROMPT_OCR_MULTI,
          file_urls: [fileUrl],
          response_json_schema: GASTO_OCR_SCHEMA_MULTI,
        };
        if (precision) invokeArgs.model = 'gemini_3_flash';
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM(invokeArgs);
        resultado = res && typeof res === 'object' ? res : (res?.output || null);
      } catch (e) {
        ocrError = e?.message || 'Error InvokeLLM';
      }

      if (ocrError || !resultado || !Array.isArray(resultado.documentos)) {
        errores.push({ foto: archivo.nombre || fileUrl, error: ocrError || 'Respuesta inválida del OCR' });
        continue;
      }

      // 2. Convertir a registros procesados
      const procesados = procesarResultadoMulti(resultado, fileUrl);
      if (procesados.length === 0) {
        // foto sin tickets válidos (reverso/inválida) → la saltamos
        continue;
      }

      // 3. Crear un RegistroGasto por ticket detectado en esta foto
      for (const p of procesados) {
        const doc = p.datos;
        const cicloMes = doc.fecha_documento ? doc.fecha_documento.slice(0, 7) : (original.ciclo_mes || new Date().toISOString().slice(0, 7));
        const nuevo = {
          operario_id: original.operario_id,
          operario_name: original.operario_name,
          operario_email: original.operario_email,
          categoria: doc.categoria || original.categoria || 'otros',
          importe: doc.importe != null ? Number(doc.importe) : 0,
          fecha_documento: doc.fecha_documento || original.fecha_documento,
          fecha_creacion_real: original.fecha_creacion_real || new Date().toISOString().slice(0, 10),
          nombre_comercio: doc.nombre_comercio || '',
          nif_comercio: doc.nif_comercio || '',
          numero_factura: doc.numero_factura || '',
          codigo_validacion_fiscal: doc.codigo_validacion_fiscal || '',
          localidad: doc.localidad || '',
          forma_pago_documento: doc.forma_pago_documento || '',
          hora_documento: doc.hora_documento || '',
          concepto: doc.concepto || '',
          obra_id: original.obra_id || '',
          obra_name: original.obra_name || '',
          obra_tipo: original.obra_tipo || '',
          origen_pago: original.origen_pago || 'medios_propios',
          estado: 'borrador',
          ocr_status: 'procesado',
          ocr_raw: doc.ocr_raw || JSON.stringify(doc),
          precisa_precision: p.precisa_precision,
          precision_motivo: p.precision_motivo || '',
          precision_modelo_usado: precision ? 'gemini_3_flash' : 'automatic',
          ciclo_mes: cicloMes,
          numero_secuencia: siguienteSec++,
          archivos: [{ url: fileUrl, nombre: archivo.nombre || '', tipo: archivo.tipo || '' }],
          notas_admin: `Reconstruido desde ${original.numero_nota || original.id} por ${user.email} (${new Date().toISOString()})`,
        };
        try {
          const creado = await base44.asServiceRole.entities.RegistroGasto.create(nuevo);
          registrosCreados.push({
            id: creado.id,
            importe: nuevo.importe,
            fecha_documento: nuevo.fecha_documento,
            nombre_comercio: nuevo.nombre_comercio,
            categoria: nuevo.categoria,
            ciclo_mes: nuevo.ciclo_mes,
            precisa_precision: nuevo.precisa_precision,
            foto: archivo.nombre || fileUrl,
            tickets_en_foto: p._total_en_foto,
          });
        } catch (e) {
          errores.push({ foto: archivo.nombre || fileUrl, error: 'Create: ' + (e?.message || 'fallo') });
        }
      }
    }

    // 4. Anular el registro original (no borrar: auditoría)
    if (registrosCreados.length > 0) {
      await base44.asServiceRole.entities.RegistroGasto.update(original.id, {
        estado: 'rechazada',
        notas_admin: `Anulado por reconstrucción multi-ticket (${registrosCreados.length} registros creados desde sus ${archivos.length} fotos) por ${user.email} el ${new Date().toISOString()}.`,
      });
    }

    return Response.json({
      success: true,
      registro_original_id: original.id,
      registro_original_nota: original.numero_nota,
      total_archivos_procesados: archivos.length,
      total_creados: registrosCreados.length,
      total_omitidos: errores.length,
      registros_creados: registrosCreados,
      errores,
      modelo_usado: precision ? 'gemini_3_flash' : 'automatic',
      ejecutado_por: user.email,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}