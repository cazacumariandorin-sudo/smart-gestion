import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';
import { OCR_CONFIG } from '../../shared/ingenieriaOcrConfig.ts';

/**
 * procesarListadoPuntos
 * OCR+IA especializado en listados de puntos / pedidos ingenieriles (BMS,
 * refrigeración industrial). Extrae puntos con ID (PT-01), descripción
 * técnica, referencia de equipo y ubicación — sin campos comerciales
 * (PVP/descuento/IVA van en la factura, no en el listado de puntos).
 *
 * Patrón: Base44 InvokeLLM PRIMARIO + Anthropic Claude FALLBACK (aiOrchestrator).
 * No escribe en DB — solo extracción.
 *
 * Acceso: admin, propietario, gerencia e ingeniero.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user?.role || 'operario';
    if (role !== 'admin' && role !== 'propietario' && role !== 'gerencia' && role !== 'ingeniero') {
      return Response.json({ error: 'Forbidden: el módulo Ingeniería requiere rol admin, gerencia o ingeniero' }, { status: 403 });
    }

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const { prompt, schema: responseSchema } = OCR_CONFIG['listado_puntos'];

    const r = await ocrDocumento(base44, {
      file_url,
      file_tipo: file_tipo || 'image/jpeg',
      prompt,
      response_json_schema: responseSchema,
    });

    if (!r.success) {
      return Response.json({ error: r.error, success: false }, { status: 502 });
    }

    return Response.json({
      success: true,
      datos: r.datos,
      modelo: r.modelo,
      fallback: r.fallback,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300), success: false }, { status: 500 });
  }
}