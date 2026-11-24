/**
 * presupuestoLogos — logotipos disponibles para los presupuestos.
 * El logo elegido se guarda en el presupuesto (campo `logo_id`) y es el que se usa al exportar el PDF.
 *
 * Para cambiar el segundo logo: sustituir public/logos/logo-2.png (PNG o JPEG) y, si se quiere, el nombre aquí.
 * IMPORTANTE: los ids deben coincidir con LOGOS_VALIDOS de base44/shared/presupuestoReglas.ts
 * (el frontend no puede importar de base44/shared).
 */
import { SIMANTEC_LOGO_PNG_BASE64 } from '@/lib/simantecLogoData';

export const LOGO_POR_DEFECTO = 'principal';

export const LOGOS_PRESUPUESTO = [
  { id: 'principal', nombre: 'Logo 1', vista: '/simantec-icon-192.png', dataUrl: SIMANTEC_LOGO_PNG_BASE64 },
  { id: 'alternativo', nombre: 'Logo 2', vista: '/logos/logo-2.png', dataUrl: null },
];

const CLAVE_PREFERIDO = 'presupuesto_logo_preferido';

export const logoPorId = (id) => LOGOS_PRESUPUESTO.find((l) => l.id === id) || LOGOS_PRESUPUESTO[0];

/** Último logo que eligió este usuario en este navegador (comodidad: se propone en presupuestos nuevos). */
export function getLogoPreferido() {
  try {
    const v = localStorage.getItem(CLAVE_PREFERIDO);
    return LOGOS_PRESUPUESTO.some((l) => l.id === v) ? v : LOGO_POR_DEFECTO;
  } catch (_) { return LOGO_POR_DEFECTO; }
}
export function setLogoPreferido(id) {
  try { localStorage.setItem(CLAVE_PREFERIDO, id); } catch (_) { /* sin almacenamiento */ }
}

const aDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** data URL del logo para jsPDF. Si el logo elegido no se puede cargar, usa el principal (nunca deja el PDF sin logo). */
export async function logoParaPdf(id) {
  const logo = logoPorId(id);
  if (logo.dataUrl) return logo.dataUrl;
  try {
    const resp = await fetch(logo.vista);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await aDataUrl(await resp.blob());
  } catch (_) {
    return LOGOS_PRESUPUESTO[0].dataUrl;
  }
}