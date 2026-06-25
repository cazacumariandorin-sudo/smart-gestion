import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * OCR en 2 fases para tickets y facturas de gasto.
 *
 * FASE 1 — OCR puro: extrae el texto bruto del documento (imagen/PDF).
 * FASE 2 — Análisis IA: analiza el texto bruto para estructurar los datos.
 * Si FASE 2 falla, devuelve resultado parcial con ia_disponible: false.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    if (file_url.startsWith('data:')) {
      return Response.json({
        success: false,
        error: 'La imagen no se subió a almacenamiento accesible. Verifica la conexión a Google Drive.',
        ia_disponible: false,
        ocr_disponible: false,
      }, { status: 422 });
    }

    // ■■ FASE 1: OCR RAW ■■
    let ocr_raw = '';
    let fase1_ok = false;
    try {
      const ocr_result = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR. Tu única tarea es transcribir EXACTAMENTE todo el texto visible en este documento/imagen.
REGLAS:
- Copia el texto tal como aparece, línea por línea, sin reformatear
- Si ves un código QR o código de barras, escribe su contenido decodificado entre [QR: ...] o [BARCODE: ...]
- No interpretes, no resumas, no estructures. Solo transcribe.
- Si hay tablas, represéntalas con espacios o tabulaciones
Devuelve solo el texto extraído, sin comentarios adicionales.`,
        file_urls: [file_url],
      });
      ocr_raw = typeof ocr_result === 'string' ? ocr_result : JSON.stringify(ocr_result);
      fase1_ok = ocr_raw.trim().length > 0;
    } catch (e) {
      return Response.json({
        success: false,
        error: 'OCR no disponible: ' + e.message,
        ia_disponible: false,
        ocr_disponible: false,
        ocr_raw: '',
      });
    }

    // ■■ FASE 2: ANÁLISIS IA ■■
    let datos_estructurados = null;
    let ia_disponible = false;
    let error_ia = '';
    try {
      const ia_result = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un sistema de análisis de facturas y tickets de gasto empresarial en España.
Se te proporciona el texto extraído por OCR de un documento. Analiza este texto y extrae los datos estructurados.
Si algo no está claro en el texto OCR, usa también la imagen del documento para confirmarlo.

TEXTO OCR:
${ocr_raw}

Devuelve un JSON con esta estructura exacta (usa null para los campos que no puedas determinar):
{
  "concepto": "descripción del gasto o producto/servicio principal",
  "importe": 0.00,
  "nif_comercio": "NIF o CIF del comercio (sin espacios, ej: B12345678)",
  "nombre_comercio": "nombre del establecimiento o empresa",
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "material|combustible|peaje|parking|comida|otros",
  "confianza": "alta|media|baja",
  "codigo_validacion_fiscal": "contenido del QR fiscal si existe, o null",
  "detalles_adicionales": "información relevante adicional o null",
  "mejoras_aplicadas": "breve descripción de qué corrigió o mejoró la IA respecto al OCR crudo",
  "ocr_raw": "${ocr_raw.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
}

Criterios de categoría:
- material: compras de materiales, herramientas, suministros
- combustible: gasolineras, carburante, adblue
- peaje: autopistas, peajes, túneles
- parking: aparcamientos
- comida: restaurantes, bares, supermercados (si es para trabajadores en obra)
- otros: cualquier otro tipo de gasto

Para importe usa número decimal sin símbolo €. Confianza alta = todos los datos claros, media = alguna duda, baja = datos ambiguos.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            concepto: { type: 'string' },
            importe: { type: 'number' },
            nif_comercio: { type: 'string' },
            nombre_comercio: { type: 'string' },
            fecha_documento: { type: 'string' },
            categoria_sugerida: { type: 'string' },
            confianza: { type: 'string' },
            codigo_validacion_fiscal: { type: 'string' },
            detalles_adicionales: { type: 'string' },
            mejoras_aplicadas: { type: 'string' },
            ocr_raw: { type: 'string' },
          },
        },
      });
      datos_estructurados = ia_result;
      // Asegurar que ocr_raw siempre está presente
      if (datos_estructurados && !datos_estructurados.ocr_raw) {
        datos_estructurados.ocr_raw = ocr_raw;
      }
      ia_disponible = true;
    } catch (e) {
      error_ia = e.message;
      // IA falló pero OCR OK: devolver texto bruto para que el usuario rellene manualmente
      datos_estructurados = { ocr_raw };
    }

    return Response.json({
      success: true,
      ocr_disponible: fase1_ok,
      ia_disponible,
      error_ia: error_ia || undefined,
      datos: datos_estructurados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});