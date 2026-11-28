/**
 * Empresa activa del usuario. Es un almacén de módulo (no un hook) para que
 * cualquier formulario pueda sellar sus altas con la empresa correcta sin
 * reestructurar el componente.
 */
const CLAVE = 'sg_empresa_activa';
const CLAVE_MODO = 'sg_modo_consola';
let activa = null;
const oyentes = new Set();

/** El propietario puede estar en su consola, sin empresa abierta. */
export function getModoConsola() {
  try {
    return sessionStorage.getItem(CLAVE_MODO) === '1';
  } catch (_) {
    return false;
  }
}

export function setModoConsola(modo) {
  try {
    if (modo) sessionStorage.setItem(CLAVE_MODO, '1');
    else sessionStorage.removeItem(CLAVE_MODO);
  } catch (_) {}
}

/** Deja de recordar la empresa abierta (vuelta a la consola). */
export function olvidarEmpresa() {
  activa = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch (_) {}
  oyentes.forEach((fn) => fn(null));
}

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