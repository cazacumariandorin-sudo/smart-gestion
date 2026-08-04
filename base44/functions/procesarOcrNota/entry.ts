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

    const prompt = 'Transcribe EXACTAMENTE todo el texto visible en este ticket o factura española, línea por línea. Incluye todos los números (importes, fechas, NIFs). No interpretes ni resumas. Solo transcribe el texto tal como aparece en el documento.';

    const r = await ocrDocumento(base44, { file_url, file_tipo: file_tipo || 'image/jpeg', prompt });

    if (!r.success) {
      return Response.json({ success: false, ocr_raw: '', error: r.error });
    }

    if (!r.ocr_raw || r.ocr_raw.length < 5) {
      return Response.json({ success: false, ocr_raw: '', error: 'Documento ilegible o vacío' });
    }

    return Response.json({
      success: true,
      ocr_raw: r.ocr_raw,
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