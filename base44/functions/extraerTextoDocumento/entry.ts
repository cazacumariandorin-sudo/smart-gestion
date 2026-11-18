import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Extrae el texto de un documento Word (.docx) para que la IA trabaje sobre el
// contenido real del documento y no sobre una interpretación.
// .txt/.md/.html/.csv se devuelven tal cual. Otros formatos (PDF, Excel, imágenes)
// devuelven texto vacío: el cliente decide cómo tratarlos.

const MAX_BYTES = 12 * 1024 * 1024;

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Devuelve el contenido de una entrada del ZIP (docx es un ZIP)
async function zipEntry(bytes, wanted) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();

  for (let n = 0; n < total && p + 46 <= bytes.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (name === wanted) {
      const lNameLen = dv.getUint16(localOffset + 26, true);
      const lExtraLen = dv.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compSize);
      return method === 0 ? raw : await inflateRaw(raw);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function textoDesdeWordXml(xml) {
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json().catch(() => ({}));
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const res = await fetch(file_url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return Response.json({ error: 'No se pudo descargar el documento' }, { status: 400 });

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return Response.json({ texto: '', motivo: 'Documento demasiado grande' });

    const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (esZip) {
      const doc = await zipEntry(bytes, 'word/document.xml');
      if (!doc) return Response.json({ texto: '', motivo: 'Formato no soportado para lectura directa' });
      return Response.json({ texto: textoDesdeWordXml(new TextDecoder().decode(doc)) });
    }

    const cabecera = new TextDecoder().decode(bytes.subarray(0, 200)).toLowerCase();
    if (cabecera.includes('%pdf')) return Response.json({ texto: '', motivo: 'PDF' });

    const texto = new TextDecoder().decode(bytes);
    const pareceTexto = /^[\x09\x0a\x0d\x20-\x7e\u00a1-\uffff]*$/.test(texto.slice(0, 500));
    return Response.json({ texto: pareceTexto ? texto.trim() : '', motivo: pareceTexto ? '' : 'Binario' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}