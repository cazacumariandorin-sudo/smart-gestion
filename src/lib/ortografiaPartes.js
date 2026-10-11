import { base44 } from '@/api/base44Client';

/**
 * Revisión ortográfica de Partes de Trabajo (WorkOrder).
 *
 * - Revisa en UNA sola llamada a la IA todos los textos libres del parte
 *   (descripción, observaciones, concepto del desplazamiento y nombres de material).
 * - Solo corrige ortografía, tildes, mayúsculas y puntuación. Nunca cambia números,
 *   unidades, referencias, marcas ni nombres propios.
 * - Cada corrección pasa por `cambioSeguro`: si la IA altera cifras o reescribe demasiado,
 *   se descarta y se conserva el texto original.
 * - Si la IA tarda o falla, devuelve { ok:false }: el parte se guarda igualmente.
 */

const MIN_LEN = 3;

export const ETIQUETAS = {
  description: 'Descripción',
  notes: 'Observaciones',
  desplazamiento_concepto: 'Concepto del desplazamiento',
};

export const etiquetaCampo = (clave) =>
  clave.startsWith('material_') ? `Material ${Number(clave.slice(9)) + 1}` : (ETIQUETAS[clave] || clave);

/** Textos libres revisables de un parte → { clave: texto } */
export function extraerTextos(parte = {}) {
  const t = {};
  const add = (k, v) => { if (typeof v === 'string' && v.trim().length >= MIN_LEN) t[k] = v; };
  add('description', parte.description);
  add('notes', parte.notes);
  if (parte.desplazamiento_modalidad === 'pactado') add('desplazamiento_concepto', parte.desplazamiento_concepto);
  (parte.materials || []).forEach((m, i) => add(`material_${i}`, m?.name));
  return t;
}

/** Acepta la corrección solo si no toca cifras y no reescribe el texto. */
export function cambioSeguro(antes, despues) {
  if (typeof despues !== 'string' || !despues.trim()) return false;
  const nums = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).join('|');
  if (nums(antes) !== nums(despues)) return false;
  const ratio = despues.trim().length / Math.max(1, antes.trim().length);
  return ratio >= 0.7 && ratio <= 1.35;
}

const PROMPT =
  'Eres un corrector ortográfico de español para partes de trabajo de instalaciones eléctricas y obra. ' +
  'Recibes una lista JSON [{clave, texto}]. Devuelve cada elemento con la misma "clave" y el "texto" corregido ' +
  'SOLO en: faltas de ortografía, tildes, mayúsculas al inicio de frase y signos de puntuación evidentes. ' +
  'NO reescribas, NO resumas, NO añadas ni elimines información, NO cambies números, unidades, referencias, marcas ' +
  'ni nombres propios, NO traduzcas. Conserva los saltos de línea. Si un texto ya es correcto, devuélvelo idéntico. ' +
  'Responde únicamente con el JSON {"campos":[{"clave":"...","texto":"..."}]}.';

const SCHEMA = {
  type: 'object',
  properties: {
    campos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { clave: { type: 'string' }, texto: { type: 'string' } },
        required: ['clave', 'texto'],
      },
    },
  },
  required: ['campos'],
};

export function parsearRespuesta(res) {
  let obj = res;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj.replace(/^```(?:json)?|```$/g, '').trim()); } catch { return null; }
  }
  const lista = Array.isArray(obj?.campos) ? obj.campos : (Array.isArray(obj) ? obj : null);
  if (!lista) return null;
  const out = {};
  lista.forEach((c) => { if (c && typeof c.clave === 'string' && typeof c.texto === 'string') out[c.clave] = c.texto; });
  return out;
}

async function llamarLLM(textos) {
  const entrada = Object.entries(textos).map(([clave, texto]) => ({ clave, texto }));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `${PROMPT}\n\n${JSON.stringify(entrada)}`,
    response_json_schema: SCHEMA,
  });
  return parsearRespuesta(res);
}

const conTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/**
 * Revisa un parte. Devuelve { ok, cambios:[{clave,etiqueta,antes,despues}], patch }.
 * `patch` contiene solo los campos del parte a actualizar (description, notes, materials…).
 * `llm` es inyectable (pruebas).
 */
export async function revisarParte(parte, { timeoutMs = 15000, llm = llamarLLM } = {}) {
  const textos = extraerTextos(parte);
  const claves = Object.keys(textos);
  if (!claves.length) return { ok: true, cambios: [], patch: {} };

  let corregidos;
  try {
    corregidos = await conTimeout(llm(textos), timeoutMs);
  } catch (error) {
    return { ok: false, cambios: [], patch: {}, error };
  }
  if (!corregidos) return { ok: false, cambios: [], patch: {}, error: new Error('respuesta no válida') };

  const cambios = [];
  for (const clave of claves) {
    const antes = textos[clave];
    const nuevo = typeof corregidos[clave] === 'string' ? corregidos[clave].trim() : '';
    if (!nuevo || nuevo === antes.trim()) continue;
    if (!cambioSeguro(antes, nuevo)) continue;
    cambios.push({ clave, etiqueta: etiquetaCampo(clave), antes, despues: nuevo });
  }

  const patch = {};
  let mats = null;
  for (const c of cambios) {
    if (c.clave.startsWith('material_')) {
      mats = mats || [...(parte.materials || [])];
      const i = Number(c.clave.slice(9));
      mats[i] = { ...mats[i], name: c.despues };
    } else {
      patch[c.clave] = c.despues;
    }
  }
  if (mats) patch.materials = mats;
  return { ok: true, cambios, patch };
}
