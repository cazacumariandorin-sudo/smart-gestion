// Hash, detección de duplicados y diff de extracción para Ingeniería Documentos.

export async function calcularHash(file) {
  if (!file || !crypto?.subtle) return '';
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

export function hashDoc(d) {
  return d?.datos_extraidos?._file_sha256 || '';
}

// Detecta duplicado combinando hash (fiabilidad máxima), nº documento + revisión, y nº documento sin revisión.
export function detectarDuplicado(fileHash, datos, documentos) {
  const num = (datos?.numero_documento || '').trim().toUpperCase();
  const rev = (datos?.revision || '').trim().toUpperCase();
  // 1) Hash idéntico (mismo contenido binario)
  if (fileHash) {
    const h = documentos.find(d => hashDoc(d) === fileHash);
    if (h) return { doc: h, motivo: 'contenido idéntico (hash SHA-256)', fuerza: 'alta' };
  }
  // 2) Nº documento + revisión coincidentes
  if (num && rev) {
    const m = documentos.find(d => (d.numero_documento || '').trim().toUpperCase() === num && (d.revision || '').trim().toUpperCase() === rev);
    if (m) return { doc: m, motivo: `mismo nº documento + revisión (${num} / ${rev})`, fuerza: 'alta' };
  }
  // 3) Nº documento sin revisión (posible duplicado, revisar)
  if (num) {
    const m = documentos.find(d => (d.numero_documento || '').trim().toUpperCase() === num && !(d.revision || '').trim());
    if (m) return { doc: m, motivo: `mismo nº documento sin revisión (${num})`, fuerza: 'media' };
  }
  return null;
}

export function formatVal(v) {
  if (v == null) return '∅';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 100);
  return String(v).slice(0, 100);
}

// Compara dos extracciones (datos_extraidos) y devuelve lista de cambios.
export function diffDatos(viejo = {}, nuevo = {}) {
  const v = viejo || {}, n = nuevo || {};
  const campos = new Set([...Object.keys(v), ...Object.keys(n)].filter(k => k !== '_file_sha256'));
  const out = [];
  for (const k of campos) {
    const a = JSON.stringify(v[k] ?? null);
    const b = JSON.stringify(n[k] ?? null);
    if (a !== b) {
      out.push({ campo: k, antes: v[k], despues: n[k], tipo: !(k in v) ? 'added' : 'changed' });
    }
  }
  return out;
}

export function DiffList({ diff, max = 14 }) {
  if (!diff || diff.length === 0) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
      <div className="font-medium text-amber-800">Cambios detectados ({diff.length}):</div>
      <ul className="mt-1 space-y-0.5">
        {diff.slice(0, max).map((c, i) => (
          <li key={i} className="text-amber-700 break-all">
            <span className="font-mono font-medium">{c.campo}</span>:{' '}
            {c.tipo === 'added'
              ? <span className="text-emerald-700">+ {formatVal(c.despues)}</span>
              : <><span className="line-through text-red-400">{formatVal(c.antes)}</span> → <span className="text-emerald-700">{formatVal(c.despues)}</span></>}
          </li>
        ))}
        {diff.length > max && <li className="text-muted-foreground">… y {diff.length - max} más</li>}
      </ul>
    </div>
  );
}