export const ESTADO_LEGAL_META = {
  provisional: {
    label: 'Provisional',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  pendiente_validacion: {
    label: 'Pdte. validación',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  validado_admin: {
    label: 'Validado',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  },
  oficial: {
    label: 'Oficial',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  anulado: {
    label: 'Anulado',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  },
  corregido: {
    label: 'Corregido',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
  },
};

export const ORIGEN_META = {
  trabajador: 'Trabajador',
  gerencia: 'Gerencia',
  cierre_forzado_gerencia: 'Cierre forzado',
  cierre_automatico: 'Cierre automático',
  administracion: 'Administración',
  importacion: 'Importación',
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const MESES_OPCIONES = MESES.map((label, i) => ({ value: i + 1, label }));

export function rangoPeriodo(anio, mes) {
  const pad = (n) => String(n).padStart(2, '0');
  if (mes) {
    const ultimo = new Date(anio, mes, 0).getDate();
    return { desde: `${anio}-${pad(mes)}-01`, hasta: `${anio}-${pad(mes)}-${pad(ultimo)}` };
  }
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}