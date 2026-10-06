import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarOcrNota
 * OCR de tickets/facturas. Patrón de la auditoría: Base44 InvokeLLM
 * PRIMARY (vision nativa) + Anthropic Claude FALLBACK.
 * Recibe file_url (la subida la hace el cliente con UploadFile).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, file_tipo } = body;

    if (!file_url) {
      return Response.json({
        success: false,
        ocr_raw: '',
        error: 'file_url requerido (usa UploadFile desde el cliente).',
      });
    }

    const prompt = `Analiza este ticket o factura española y extrae los campos clave en JSON:
- fecha_documento: fecha del documento en formato YYYY-MM-DD (no la fecha de hoy).
- importe: importe TOTAL final, como número (sin símbolo € ni separadores de miles; usa punto decimal, ej: 11.75).
- nombre_comercio: nombre del establecimiento emisor.
- nif_comercio: CIF/NIF del emisor, en mayúsculas (ej: A28986636).
- concepto: descripción breve del gasto (máx 60 caracteres).
- categoria: una sola palabra, en minúsculas, eligiendo UNA de estas opciones exactas:
  - "combustible" (repostajes, gasolina, diésel, gasolina, estaciones de servicio)
  - "peaje" (autopistas, peajes,Taget, AP6, comprobantes de paso, vías de peaje)
  - "parking" (parquímetros, aparcamientos, estacionamiento, ticket de aparcamiento)
  - "comida" (restaurantes, cafeterías, bares, hostelería,€ consumición)
  - "material" (ferretería, materiales, suministros, recambios, commissioners de Obra)
  - "otros" (si no encaja en ninguno de los anteriores)
- numero_factura: número de FACTURA / ALBARÁN / PROFORMA impreso en el documento (suele estar cerca del emisor o en el encabezado, con prefijos como "FAC", "FACTURA", "FACT", "ALB", "ALBARÁN", "Nº", "N.º", "PROFORMA", "PF"). IMPORTANTE: sepáralo del código legal/QR. Si el documento es factura/albarán/proforma, devuelve el número legible que el operario podría usar para cruzar con contabilidad (ej: "FAC-2026-001", "ALB/2026/123", "PROFORMA 456", "Nº 00087"). En tickets simplificados que no tienen número de factura, devuelve cadena vacía "". NO uses el código de validación QR aquí (va en codigo_validacion_fiscal).
- codigo_validacion_fiscal: número de factura simplificada, código QR o de barras que aparece como identificador fiscal único; si no aparece, cadena vacía.
- localidad: población/localidad del emisor impresa en el justificante (ej: Madrid, Valencia). Solo la localidad, no la dirección completa. Si no aparece, cadena vacía.
- forma_pago_documento: forma de pago impresa en el justificante (EFECTIVO, TARJETA, TRANSFERENCIA, etc.), tal cual aparece. Si no aparece, cadena vacía.
- tarjeta_ultimos_digitos: SOLO si el documento muestra una tarjeta de pago enmascarada (ej. "**** **** **** 4417", "VISA ...4417", "XXXX XXXX XXXX 4417"), extrae ÚNICAMENTE los últimos 4 dígitos visibles (ej: "4417"). NUNCA extraigas un número de tarjeta completo aunque aparezca legible — en ese caso, devuelve también solo los últimos 4 dígitos. Si no hay tarjeta o no se ven dígitos, cadena vacía "".
- ocr_raw: transcripción COMPLETA del texto visible, línea por línea, tal cual aparece.`;

    const schema = {
      type: 'object',
      properties: {
        fecha_documento: { type: 'string' },
        importe: { type: 'number' },
        nombre_comercio: { type: 'string' },
        nif_comercio: { type: 'string' },
        concepto: { type: 'string' },
        categoria: { type: 'string', enum: ['combustible', 'peaje', 'parking', 'comida', 'material', 'otros'] },
        numero_factura: { type: 'string' },
        localidad: { type: 'string' },
        forma_pago_documento: { type: 'string' },
        tarjeta_ultimos_digitos: { type: 'string' },
        codigo_validacion_fiscal: { type: 'string' },
        ocr_raw: { type: 'string' },
      },
      required: ['categoria', 'importe', 'fecha_documento', 'nombre_comercio'],
    };

    const r = await ocrDocumento(base44, {
      file_url,
      file_tipo: file_tipo || 'image/jpeg',
      prompt,
      response_json_schema: schema,
    });

    if (!r.success) {
      return Response.json({ success: false, ocr_raw: '', error: r.error });
    }

    const datos = r.datos || {};
    const raw = datos.ocr_raw || r.ocr_raw || '';
    if (!raw || raw.length < 5) {
      return Response.json({ success: false, ocr_raw: '', error: 'Documento ilegible o vacío' });
    }

    return Response.json({
      success: true,
      datos,
      ocr_raw: raw,
      modelo: r.modelo,
      fallback: r.fallback,
    });
  } catch (error) {
    return Response.json({
      success: false,
      ocr_raw: '',
      error: String(error?.message || error).slice(0, 200),
    });
  }
});