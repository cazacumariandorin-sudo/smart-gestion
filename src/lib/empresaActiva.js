/**
 * Empresa activa del usuario. Es un almacén de módulo (no un hook) para que
 * cualquier formulario pueda sellar sus altas con la empresa correcta sin
 * reestructurar el componente.
 */
const CLAVE = 'sg_empresa_activa';
let activa = null;
const oyentes = new Set();

export function getEmpresaActiva() {
  return activa;
}

export function setEmpresaActiva(empresa) {
  activa = empresa && empresa.id ? { id: empresa.id, nombre: empresa.nombre || '' } : null;
  try {
    if (activa?.id) localStorage.setItem(CLAVE, activa.id);
  } catch (_) {}
  oyentes.forEach((fn) => fn(activa));
}

export function leerEmpresaRecordada() {
  try {
    return localStorage.getItem(CLAVE) || '';
  } catch (_) {
    return '';
  }
}

export function suscribirEmpresa(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Añade la empresa activa a los datos de un registro nuevo. */
export function sellarEmpresa(datos) {
  if (!activa?.id) return datos;
  return { ...datos, empresa_id: activa.id, empresa_nombre: activa.nombre };
}