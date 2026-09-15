import { cn } from '@/lib/utils';

/**
 * Semáforo de trazabilidad del ciclo de vida de un documento (gasto o material).
 * Prioridad (de mayor a menor): discrepancia > conciliado > descargado > consolidado
 * > pendiente contabilidad > pendiente aprobación > precisión > sin procesar.
 *
 * Se integra en las vistas existentes (NotaGastoCard, ConciliacionPanel, etc.)
 * según el RLS de cada rol: cada uno ve el semáforo de los documentos a su alcance.
 */

const STYLE = {
  rojo:    { dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',     bg: 'bg-red-50 dark:bg-red-950/40' },
  ambar:   { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  verde:   { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  azul:    { dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-950/40' },
  slate:   { dot: 'bg-slate-400',   text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/40' },
};

function computeSemaf(doc) {
  if (!doc) return { key: 'slate', label: '—' };
  if (doc.estado_conciliacion === 'conciliado_con_discrepancia') return { key: 'ambar', label: 'Discrepancia' };
  if (doc.estado_conciliacion === 'conciliado' || doc.conciliado_contabilidad) return { key: 'verde', label: 'Conciliado' };
  if (doc.descargado_contabilidad) return { key: 'azul', label: 'Descargado' };
  if (doc.consolidado_ciclo || doc.nota_mensual_id || doc.estado === 'pagada') return { key: 'verde', label: 'Consolidado' };
  if (doc.estado === 'en_administracion' || doc.estado === 'registrado') return { key: 'ambar', label: 'Pend. contabilidad' };
  if (doc.estado === 'aprobado_gerencia' || doc.estado === 'pendiente' || doc.estado === 'enviada' || doc.estado === 'aprobada') return { key: 'ambar', label: 'Pend. aprobación' };
  if (doc.precisa_precision) return { key: 'rojo', label: 'Precisión' };
  if (doc.estado === 'rechazada') return { key: 'rojo', label: 'Rechazado' };
  if (!doc.estado || doc.estado === 'borrador') return { key: 'rojo', label: 'Sin procesar' };
  return { key: 'slate', label: '—' };
}

export default function SemaforoTrazabilidadBadge({ doc, className, showLabel = true }) {
  const { key, label } = computeSemaf(doc);
  const s = STYLE[key];
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-transparent', s.bg, s.text, className)}
      title={`Trazabilidad: ${label}`}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}