import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const base64puro = file_base64.includes(',') ? file_base64.split(',')[1] : file_base64;
    const mimeType = file_base64.startsWith('data:')
      ? file_base64.split(';')[0].split(':')[1]
      : (file_tipo || 'image/jpeg');

    const resultado = await base44.integrations.Core.InvokeLLM({
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64puro } },
          { type: 'text', text: 'Transcribe EXACTAMENTE todo el texto visible en este ticket o factura, linea por linea. Copia todos los numeros tal como aparecen. No interpretes ni resumas. Solo transcribe.' },
        ],
      }],
    });

    const ocr_raw = (typeof resultado === 'string' ? resultado : resultado?.content?.[0]?.text || resultado?.text || '').trim();

    if (!ocr_raw || ocr_raw.length < 5) {
      return Response.json({ success: false, ocr_raw: '', error: 'Documento ilegible' });
    }

    return Response.json({ success: true, ocr_raw });

  } catch (error) {
    return Response.json({ success: false, ocr_raw: '', error: String(error?.message || error).slice(0, 200) });
  }
});