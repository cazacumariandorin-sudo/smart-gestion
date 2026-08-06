import { base44 } from '@/api/base44Client';

/**
 * Corrige ortografía y gramática en español técnico usando IA.
 * Normaliza nomenclatura de material eléctrico/construcción sin inventar datos
 * ni añadir marcas comerciales. Devuelve el texto limpio (sin comillas ni explicaciones).
 *
 * Reutilizado por CorrectorOrtograficoButton y por AutoCorrectTextarea/Input.
 */
export async function corregirTextoIA(text) {
  if (!text || !String(text).trim()) return '';
  const res = await base44.integrations.Core.InvokeLLM({
    prompt:
      "Eres un corrector ortográfico y gramatical de español técnico. " +
      "Corrige ortografía, tildes, mayúsculas y gramática del siguiente texto DEVOLVIENDO ÚNICAMENTE el texto corregido, " +
      "sin explicaciones, sin comillas y conservando el formato de líneas y comillas si las hubiera. " +
      "Las siglas, unidades y referencias técnicas (A, mA, kW, V, IP, 2P, 4P, curva C, etc.) deben permanecer exactas. " +
      "Si aparece un nombre comercial aproximado de material eléctrico o de construcción, normalízalo a la nomenclatura " +
      "técnica más probable (ej: 'Automatico 4x63A/300mA' → 'Automático 4P 63A curva C 300mA diferencial') sin inventar datos ni añadir marcas comerciales.\n\n" +
      "Texto:\n" + text,
  });
  const corregido = typeof res === 'string' ? res : res?.response || res?.text || res?.output || '';
  return String(corregido || '').trim().replace(/^["'“”`]+|["'“”`]+$/g, '');
}

// Umbral mínimo para lanzar corrección automática (evita coste en textos cortos tipo tags)
export const MIN_LEN_AUTOCORRECCION = 12;