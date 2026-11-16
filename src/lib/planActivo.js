/**
 * planActivo.js — plan comercial vigente de la app (una sola carga, sin hooks).
 *
 * Se resuelve a partir del plan de la empresa principal del workspace. Si no hay
 * empresa principal o no tiene plan asignado, se usa 'completo' (la app no cambia).
 *
 * Funciona con caché en memoria + suscriptores, igual que el simulador de roles,
 * para que useUserRole lo lea sin useQuery (evita inestabilidad de hooks).
 */
import { base44 } from '@/api/base44Client';
import { PLAN_POR_DEFECTO } from '@/lib/planes';

let activo = {
  key: PLAN_POR_DEFECTO,
  empresaId: null,
  empresaNombre: '',
  registro: null,
};
let cargando = null;
let cargado = false;
const listeners = new Set();

function publicar(nuevo) {
  activo = nuevo;
  listeners.forEach((fn) => fn(activo));
}

export function getPlanActivo() {
  return activo.key;
}

export function getPlanActivoDetalle() {
  return activo;
}

export function suscribirPlan(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function cargarPlanActivo({ forzar = false } = {}) {
  if (!forzar && cargado) return Promise.resolve(activo);
  if (cargando && !forzar) return cargando;

  cargando = (async () => {
    const [empresas, planes] = await Promise.all([
      base44.entities.Empresa.list('-created_date', 100),
      base44.entities.PlanEmpresa.list('-created_date', 200),
    ]);
    const listaEmpresas = empresas || [];
    const principal = listaEmpresas.find((e) => e.es_principal) || null;
    const registro = principal
      ? (planes || []).find((p) => p.empresa_id === principal.id && p.activo !== false) || null
      : null;

    publicar({
      key: registro?.plan || PLAN_POR_DEFECTO,
      empresaId: principal?.id || null,
      empresaNombre: principal?.nombre || '',
      registro,
    });
    cargado = true;
    return activo;
  })().finally(() => {
    cargando = null;
  });

  return cargando;
}