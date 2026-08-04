/**
 * Orquestador de IA — patrón de la auditoría:
 *   PRIMARY  : Base44 InvokeLLM (nativo, privado, barato, bajo) latencia).
 *   FALLBACK : Anthropic Claude Vision (cuando Base44 IA no responde).
 *
 * Uso:
 *   const r = await ocrDocumento(base44, {
 *     file_url,
 *     file_tipo: 'image/jpeg',
 *     prompt: 'Transcribe...',
 *     response_json_schema: schema,  // opcional
 *   });
 *   // { success, datos?, ocr_raw?, modelo, fallback, error? }
 *
 * Diseñado para OCR y extracción estructurada de documentos.
 * InvokeLLM soporta file_urls en cualquier modelo; el fallback Anthropic
 * descarga la URL a base64 (imagen o PDF) y la envía vía vision.
 */

interface OCRParams {
  file_url: string;
  file_tipo?: string;
  prompt: string;
  response_json_schema?: object;
}

interface OCRResult {
  success: boolean;
  datos?: any;
  ocr_raw?: string;
  modelo: 'base44' | 'claude' | null;
  fallback: boolean;
  error?: string;
}

// ── PRIMARY: Base44 InvokeLLM (vision + texto estructurado) ──────────────────
async function primaryInvokeLLM(base44, params: OCRParams): Promise<OCRResult> {
  try {
    const invokeArgs: any = {
      prompt: params.prompt,
      file_urls: [params.file_url],
    };
    if (params.response_json_schema) {
      invokeArgs.response_json_schema = params.response_json_schema;
    }
    const result = await base44.integrations.Core.InvokeLLM(invokeArgs);
    if (result === null || result === undefined || result === '') {
      return { success: false, modelo: null, fallback: false, error: 'InvokeLLM: respuesta vacía' };
    }
    // Si se pidió schema, Base44 devuelve objeto; si no, devuelve string.
    if (params.response_json_schema) {
      return { success: true, datos: result, ocr_raw: result?.ocr_raw, modelo: 'base44', fallback: false };
    }
    const texto = typeof result === 'string' ? result : JSON.stringify(result);
    return { success: true, ocr_raw: texto, modelo: 'base44', fallback: false };
  } catch (e) {
    const msg = e?.message || String(e);
    console.warn('[aiOrchestrator] Primary InvokeLLM falló:', msg);
    return { success: false, modelo: null, fallback: false, error: msg };
  }
}

// ── FALLBACK: Anthropic Claude Vision (descarga URL -> base64) ───────────────
async function fallbackAnthropicOCR(params: OCRParams): Promise<OCRResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
  if (!apiKey) {
    return { success: false, modelo: null, fallback: false, error: 'ANTHROPIC_API_KEY no configurada (fallback no disponible)' };
  }
  try {
    const fr = await fetch(params.file_url);
    if (!fr.ok) {
      return { success: false, modelo: null, fallback: false, error: `No se pudo descargar ${params.file_url} (${fr.status})` };
    }
    const buf = new Uint8Array(await fr.arrayBuffer());
    // btoa espera string binario; trocea para evitar overflow de call stack.
    let base64 = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      base64 += btoa(String.fromCharCode(...buf.subarray(i, i + CHUNK)));
    }

    const mimeType = (params.file_tipo || 'image/jpeg').toLowerCase();
    const isPdf = mimeType === 'application/pdf';
    const mediaType = isPdf ? 'application/pdf' : (
      mimeType === 'image/png' ? 'image/png' :
      mimeType === 'image/gif' ? 'image/gif' :
      mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg'
    );

    const contentBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

    const suffixSchema = params.response_json_schema
      ? '\n\nResponde SOLO con un JSON válido que cumpla el esquema solicitado, sin texto adicional ni markdown.'
      : '';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: params.prompt + suffixSchema }],
        }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { success: false, modelo: null, fallback: false, error: `Anthropic ${res.status}: ${errBody.slice(0, 160)}` };
    }

    const data = await res.json();
    const text = (data.content?.[0]?.text || '').trim();

    if (params.response_json_schema) {
      try {
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
        return { success: true, datos: parsed, ocr_raw: parsed?.ocr_raw, modelo: 'claude', fallback: true };
      } catch (_) {
        return { success: false, modelo: null, fallback: false, error: 'Anthropic no devolvió JSON válido', ocr_raw: text };
      }
    }
    return { success: true, ocr_raw: text, modelo: 'claude', fallback: true };
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[aiOrchestrator] Fallback Anthropic falló:', msg);
    return { success: false, modelo: null, fallback: false, error: msg };
  }
}

// ── Orquestador principal ─────────────────────────────────────────────────────
export async function ocrDocumento(base44, params: OCRParams): Promise<OCRResult> {
  if (!params?.file_url) {
    return { success: false, modelo: null, fallback: false, error: 'file_url requerido' };
  }
  const primary = await primaryInvokeLLM(base44, params);
  if (primary.success) return primary;

  console.warn('[aiOrchestrator] Primary falló, intentando fallback Anthropic...');
  const fb = await fallbackAnthropicOCR(params);
  if (fb.success) return fb;

  return {
    success: false,
    modelo: null,
    fallback: false,
    error: `PRIMARY(${primary.error || 'fail'}) | FALLBACK(${fb.error || 'fail'})`,
  };
}