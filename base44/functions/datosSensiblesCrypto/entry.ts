import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Cifrado/descifrado real (AES-256-GCM) de los campos sensibles de
 * DatosSensiblesUsuario / DatosSensiblesCliente, con auditoría de accesos.
 *
 * Payload:
 *  - { action: 'encrypt', fields: { campo: valor, ... } }
 *  - { action: 'decrypt', tipo: 'usuario'|'cliente', registro_id, registro_nombre, fields: { campo: cifrado, ... } }
 */
const ENC_PREFIX = 'v1';

async function getKey() {
  const secret = Deno.env.get('ENCRYPTION_KEY');
  if (!secret) throw new Error('ENCRYPTION_KEY no configurada');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function encryptValue(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(String(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${ENC_PREFIX}:${toBase64(iv)}:${toBase64(ciphertext)}`;
}

async function decryptValue(key, blob) {
  const parts = String(blob).split(':');
  if (parts.length !== 3 || parts[0] !== ENC_PREFIX) return blob; // valor vacío o legado, no cifrado
  const iv = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo admin o gerencia' }, { status: 403 });
    }

    const { action, fields = {}, tipo, registro_id, registro_nombre } = await req.json();
    const key = await getKey();

    if (action === 'encrypt') {
      const out = {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = (v === '' || v === null || v === undefined) ? '' : await encryptValue(key, v);
      }
      return Response.json({ success: true, encrypted: out });
    }

    if (action === 'decrypt') {
      const out = {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = (v === '' || v === null || v === undefined) ? '' : await decryptValue(key, v);
      }
      if (tipo && registro_id) {
        await base44.asServiceRole.entities.DatosSensiblesAccessLog.create({
          entidad_tipo: tipo,
          registro_id,
          registro_nombre: registro_nombre || '',
          accion: 'ver_detalle',
          usuario_email: user.email,
          fecha: new Date().toISOString(),
        });
      }
      return Response.json({ success: true, decrypted: out });
    }

    return Response.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});