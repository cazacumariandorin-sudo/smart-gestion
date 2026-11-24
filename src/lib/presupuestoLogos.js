/**
 * presupuestoLogos — logotipos disponibles para los presupuestos.
 * El logo elegido se guarda en el presupuesto (campo `logo_id`) y es el que se usa al exportar el PDF.
 *
 * El Logo 2 se sube en Sistema > Empresas (empresa principal) y se guarda en `logo_2_url`.
 * Si la empresa no tiene Logo 2 subido, solo se ofrece el Logo 1 (nunca un logo roto).
 * IMPORTANTE: los ids deben coincidir con LOGOS_VALIDOS de base44/shared/presupuestoReglas.ts
 * (el frontend no puede importar de base44/shared).
 */
import { base44 } from '@/api/base44Client';
import { SIMANTEC_LOGO_PNG_BASE64 } from '@/lib/simantecLogoData';

export const LOGO_POR_DEFECTO = 'principal';

const LOGO_1 = { id: 'principal', nombre: 'Logo 1', vista: '/simantec-icon-192.png', dataUrl: SIMANTEC_LOGO_PNG_BASE64 };

/** Definición base de los logos (sin datos de empresa). */
export const LOGOS_PRESUPUESTO = [LOGO_1];

/** Logos disponibles según la empresa: el Logo 2 sale de Sistema > Empresas. */
export function logosPresupuesto(empresa) {
  const logo2 = empresa?.logo_2_url;
  if (!logo2) return [LOGO_1];
  return [LOGO_1, { id: 'alternativo', nombre: 'Logo 2', vista: logo2, dataUrl: null }];
}

/** Lee la empresa principal y devuelve sus logos para los presupuestos. */
export async function cargarLogosPresupuesto() {
  try {
    const lista = await base44.entities.Empresa.filter({ es_principal: true });
    return logosPresupuesto(lista?.[0]);
  } catch (_) {
    return [LOGO_1];
  }
}

export const logoPorId = (id, logos = LOGOS_PRESUPUESTO) => logos.find((l) => l.id === id) || logos[0];

const CLAVE_PREFERIDO = 'presupuesto_logo_preferido';

/** Último logo que eligió este usuario en este navegador (comodidad: se propone en presupuestos nuevos). */
export function getLogoPreferido() {
  try {
    const v = localStorage.getItem(CLAVE_PREFERIDO);
    return ['principal', 'alternativo'].includes(v) ? v : LOGO_POR_DEFECTO;
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

/**
 * data URL del logo para jsPDF. El Logo 2 viene de la empresa (`logo_2_url`).
 * Si el logo elegido no se puede cargar, usa el principal (nunca deja el PDF sin logo).
 */
export async function logoParaPdf(id, empresa) {
  const logo = logoPorId(id, logosPresupuesto(empresa));
  if (logo.dataUrl) return logo.dataUrl;
  try {
    const resp = await fetch(logo.vista);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await aDataUrl(await resp.blob());
  } catch (_) {
    return LOGO_1.dataUrl;
  }
}