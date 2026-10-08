

// Utilidades compartidas para Partes de Trabajo (WorkOrder).

export const DESPLAZAMIENTO_LABELS = {
  desplazamiento: 'Desplazamiento a obra',
  traslado: 'Traslado entre obras',
  compras: 'Compra de materiales',
  otro: 'Otro',
};

export const FIRMA_STATUS_LABELS = {
  sin_firmar: 'Sin firmar',
  pendiente_cliente: 'Pendiente cliente',
  pendiente_tecnico: 'Pendiente tecnico',
  firmado_tecnico: 'Firmado tecnico',
  firmado_ambos: 'Firmado ✓',
  rechazado: 'Rechazado',
};

/** Fecha local YYYY-MM-DD (toISOString() devuelve UTC y a primera hora da el día anterior). */
export function hoyLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Calcula firma_status a partir de las firmas presentes. */
export function calcularFirmaStatus(actual, firmaOperario, firmaCliente) {
  if (firmaOperario && firmaCliente) return 'firmado_ambos';
  if (actual === 'rechazado') return 'rechazado';
  if (firmaOperario) return actual === 'pendiente_cliente' ? 'pendiente_cliente' : 'firmado_tecnico';
  if (firmaCliente) return 'pendiente_tecnico';
  return 'sin_firmar';
}

/**
 * Normaliza el payload antes de enviarlo a Base44.
 * - '' en campos number/enum se elimina (el esquema no los acepta vacíos).
 * - '__manual__' (centinela del selector de obra) nunca se guarda.
 * - opts.clear=true (actualización): permite "vaciar" valores ya guardados.
 */
export function limpiarParte(data, opts = {}) {
  const out = { ...data };
  if (out.project === '__manual__') out.project = '';
  out.project = (out.project || '').trim();

  ['desplazamiento_valor', 'desplazamiento_importe_eur'].forEach((k) => {
    const v = out[k];
    const vacio = v === '' || v === null || v === undefined || Number.isNaN(Number(v));
    if (vacio) { if (opts.clear) out[k] = 0; else delete out[k]; }
    else out[k] = Number(v);
  });

  if (!Object.keys(DESPLAZAMIENTO_LABELS).includes(out.desplazamiento_tipo)) delete out.desplazamiento_tipo;

  ['vehiculo_id', 'vehiculo_matricula'].forEach((k) => {
    if (!out[k]) { if (opts.clear) out[k] = ''; else delete out[k]; }
  });
  return out;
}

/** Valida y limpia filas de operarios/materiales. Devuelve { ok, error, workers, materials }. */
export function validarFilas(workers = [], materials = []) {
  for (const w of workers) {
    if (!(w.name || '').trim() && Number(w.hours) > 0) return { ok: false, error: 'Falta el nombre de un operario con horas' };
  }
  for (const m of materials) {
    if (!(m.name || '').trim() && Number(m.quantity) > 0) return { ok: false, error: 'Falta el nombre de un material con cantidad' };
  }
  return {
    ok: true,
    workers: workers.filter((w) => (w.name || '').trim()),
    materials: materials.filter((m) => (m.name || '').trim()),
  };
}

/** Mensaje de error comprensible para el técnico. */
export function mensajeErrorGuardado(err) {
  const status = err?.response?.status ?? err?.status;
  const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || '';
  if (status === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión (los datos del formulario se conservan).';
  if (status === 403) return 'Tu rol no tiene permiso para guardar este parte. Avisa a administración.';
  if (status === 408 || err?.code === 'ECONNABORTED' || /timeout|network|failed to fetch|abort/i.test(msg) ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'Sin conexión o conexión muy lenta. Tus datos siguen en el formulario; inténtalo de nuevo en unos segundos.';
  }
  if (status === 400 || status === 422) return `Datos no válidos: ${msg || 'revisa los campos'}`;
  return `Error al guardar el parte: ${msg || 'inténtalo de nuevo'}`;
}

/* ───────── Borrador local (no perder 5 min de trabajo si falla la red) ───────── */
const DRAFT_KEY = 'smartgestion:wo_draft_v1';
const DRAFT_MAX_AGE = 48 * 3600 * 1000;

export function formVacioParte(f) {
  return !(f.project || f.description || f.notes || f.client_id || f.firma_operario || f.firma_cliente ||
    (f.workers || []).length || (f.materials || []).length);
}
export function leerBorrador() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { form, ts } = JSON.parse(raw);
    if (!form || Date.now() - ts > DRAFT_MAX_AGE) return null;
    return form;
  } catch { return null; }
}
export function guardarBorrador(form) {
  try {
    if (formVacioParte(form)) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, ts: Date.now() }));
  } catch { /* almacenamiento no disponible */ }
}
export function borrarBorrador() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

/** Reduce una foto (lado máx. 1600 px, JPEG 0.72). Si falla devuelve el original. */
export async function comprimirImagen(file, maxLado = 1600, calidad = 0.72) {
  try {
    if (!file?.type?.startsWith('image/') || file.size < 300 * 1024) return file;
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', calidad));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
