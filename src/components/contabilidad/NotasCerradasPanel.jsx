import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSpreadsheet, Download, ExternalLink } from 'lucide-react';
import ConciliacionBadge from '@/components/conciliacion/ConciliacionBadge';

const ESTADOS_CERRADOS = ['enviada', 'aprobada', 'en_contabilidad', 'pagada'];

const ESTADO_STYLE = {
  enviada: 'bg-blue-100 text-blue-700 border-blue-200',
  aprobada: 'bg-amber-100 text-amber-700 border-amber-200',
  en_contabilidad: 'bg-purple-100 text-purple-700 border-purple-200',
  pagada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rechazada: 'bg-red-100 text-red-700 border-red-200',
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * Pestaña "Notas de gastos cerradas" — NotaMensualGasto ya cerrada (enviada/aprobada/
 * en_contabilidad/pagada) agrupando visualmente sus RegistroGasto.
 */
export default function NotasCerradasPanel({ rango, periodoKey }) {
  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['contabilidad-notas-cerradas', periodoKey],
    queryFn: async () => {
      // NotaMensualGasto no tiene fecha_documento; filtramos por fecha_cierre dentro del rango
      const list = await base44.entities.NotaMensualGasto.filter({
        estado: { $in: ESTADOS_CERRADOS },
        fecha_cierre: { $gte: rango.inicio, $lte: rango.fin },
      }, '-fecha_cierre', 200);
      return list;
    },
  });

  // IDs de registros para consultar conciliación agregada
  const todosIds = useMemo(() => notas.flatMap(n => n.registros_ids || []), [notas]);

  const { data: registrosMap = {} } = useQuery({
    queryKey: ['contabilidad-notas-registros', periodoKey, todosIds.length],
    queryFn: async () => {
      if (!todosIds.length) return {};
      const got = await Promise.all(todosIds.map(id => base44.entities.RegistroGasto.get(id).catch(() => null)));
      const map = {};
      got.filter(Boolean).forEach(r => { map[r.id] = r; });
      return map;
    },
    enabled: todosIds.length > 0,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (notas.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">No hay notas de gastos cerradas en este periodo.</Card>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {notas.length} nota(s) cerrada(s) en el periodo <span className="font-medium text-foreground">{rango.etiqueta}</span>. Cada nota agrupa los registros verificados/aprobados que se entregan a la gestoría.
      </p>
      {notas.map(nota => {
        const regs = (nota.registros_ids || []).map(id => registrosMap[id]).filter(Boolean);
        const conciliados = regs.filter(r => r?.estado_conciliacion === 'conciliado' || r?.estado_conciliacion === 'conciliado_con_discrepancia').length;
        return (
          <Card key={nota.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-primary">{nota.numero_ciclo || nota.ciclo_mes || '—'}</span>
                  <Badge className={`text-[10px] border ${ESTADO_STYLE[nota.estado] || ESTADO_STYLE.borrador}`}>{nota.estado}</Badge>
                </div>
                <p className="text-sm font-medium mt-0.5">{nota.operario_name || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  Cierre: {nota.fecha_cierre || '—'} · {nota.total_registros || regs.length} registros
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{(nota.total_importe || 0).toFixed(2)} €</p>
                <p className="text-xs text-muted-foreground">
                  Saldo: {(nota.importe_neto_liquidar ?? nota.saldo_pendiente ?? 0).toFixed(2)} €
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs flex-wrap">
              <ConciliacionBadge nota={{ estado_conciliacion: conciliados === regs.length && regs.length > 0 ? 'conciliado' : 'no_conciliado' }} />
              <span className="text-muted-foreground">{conciliados} de {regs.length} registros conciliados</span>
              {nota.export_contabilidad_url && (
                <a href={nota.export_contabilidad_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Índice PDF exportado
                </a>
              )}
            </div>

            {regs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver {regs.length} registros del ciclo</summary>
                <div className="mt-2 space-y-1">
                  {regs.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-primary">{r.numero_nota || '—'}</span>
                        <span className="ml-1.5 truncate">{r.nombre_comercio || '—'}</span>
                        <span className="text-muted-foreground ml-1.5">{r.fecha_documento || ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ConciliacionBadge nota={r} />
                        <span className="font-medium">{(r.importe || 0).toFixed(2)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}