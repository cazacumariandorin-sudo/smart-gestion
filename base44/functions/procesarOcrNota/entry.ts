import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota - OCR via API directa de Anthropic.
 * InvokeLLM de Base44 no soporta vision. Llamamos directamente a Anthropic.
 * Requiere ANTHROPIC_API_KEY en las variables de entorno del proyecto Base44.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_base64, file_tipo } = body;

    if (!file_base64) {
      return Response.json({ success: false, ocr_raw: '', error: 'file_base64 requerido' });
    }

    // Preparar base64 puro (sin prefijo data:mime;base64,)
    const base64puro = file_base64.includes(',') ? file_base64.split(',')[1] : file_base64;
    const mimeType = file_base64.startsWith('data:')
      ? file_base64.split(';')[0].split(':')[1]
      : (file_tipo || 'image/jpeg');

    // Obtener API key de las variables de entorno del proyecto
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

    if (!apiKey) {
      return Response.json({
        success: false,
        ocr_raw: '',
        error: 'ANTHROPIC_API_KEY no configurada. Ve a Base44 > Settings > Environment Variables y añade tu clave.',
      });
    }

    // Llamada directa a la API de Anthropic con vision
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64puro },
              },
              {
                type: 'text',
                text: 'Transcribe EXACTAMENTE todo el texto visible en este ticket o factura española, linea por linea. Incluye todos los numeros (importes, fechas, NIFs). No interpretes ni resumas. Solo transcribe el texto tal como aparece en el documento.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return Response.json({ success: false, ocr_raw: '', error: `API error ${response.status}: ${errBody.slice(0, 100)}` });
    }

    const data = await response.json();
    const ocr_raw = (data.content?.[0]?.text || '').trim();

    if (!ocr_raw || ocr_raw.length < 5) {
      return Response.json({ success: false, ocr_raw: '', error: 'Documento ilegible o vacio' });
    }

    return Response.json({ success: true, ocr_raw });

  } catch (error) {
    return Response.json({
      success: false,
      ocr_raw: '',
      error: String(error?.message || error).slice(0, 200),
    });
  }
});