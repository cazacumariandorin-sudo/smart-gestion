import { format, parseISO } from 'date-fns';
import { UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { metaAusencia } from '@/hooks/useAusenciasHorario';

const ESTADO_LABEL = {
  aprobada: 'Aprobada',
  pendiente: 'Pendiente',
  pendiente_revision: 'Pendiente revisión',
  justificada: 'Justificada',
  injustificada: 'Injustificada',
  sancionada: 'Sancionada',
};

const ESTADO_STYLE = {
  aprobada: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  justificada: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  pendiente_revision: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  injustificada: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  sancionada: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
};

const fmt = (d) => {
  if (!d) return '—';
  try { return format(parseISO(String(d).slice(0, 10)), 'dd/MM/yyyy'); } catch { return d; }
};

/** Detalle de ausencias y faltas del día seleccionado. */
export default function AusenciasDiaPanel({ ausencias = [], operarios = [] }) {
  if (ausencias.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <UserX className="w-4 h-4 text-red-600 dark:text-red-400" />
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Ausencias y faltas</p>
        <span className="ml-auto text-[10px] font-semibold text-red-700 dark:text-red-300">{ausencias.length}</span>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Justifica las horas que faltan en este día y detecta fichajes erróneos.
      </p>
      <div className="space-y-1.5">
        {ausencias.map((a) => {
          const m = metaAusencia(a.tipo);
          const op = operarios.find((o) => o.id === a.operario_id);
          const nombre = a.operario_name || op?.name || '—';
          const estado = a.estado || 'pendiente_revision';
          return (
            <div key={a.id} className="rounded-lg border border-border bg-background/80 p-2 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', m.dot)} />
                <span className="text-xs font-semibold truncate">{nombre}</span>
                <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-semibold', m.soft)}>{m.label}</span>
                <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-medium', ESTADO_STYLE[estado] || 'bg-muted text-muted-foreground border-border')}>
                  {ESTADO_LABEL[estado] || estado}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{fmt(a.inicio)} → {fmt(a.fin || a.inicio)}</span>
                {a.origen === 'falta' && <span className="ml-auto">Convenio Metal</span>}
              </div>
              {a.notas && <p className="text-[10px] text-muted-foreground italic border-l-2 border-border pl-1.5">{a.notas}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}