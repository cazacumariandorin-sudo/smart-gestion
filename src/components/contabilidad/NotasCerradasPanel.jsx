import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
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
 *
 * IMPORTANTE: se filtra por `ciclo_mes` (a qué mes pertenece el ciclo), NO por
 * `fecha_cierre`. `fecha_cierre` guarda la fecha real en la que alguien pulsó
 * "Consolidar" — que puede caer en un mes distinto al del propio ciclo (p. ej.
 * un ciclo de agosto consolidado el 24 de septiembre) — así que filtrar por esa
 * fecha escondía notas ya cerradas y mostraba, por coincidencia, ciclos que ni
 * siquiera estaban aprobados/pagados todavía.
 */
export default function NotasCerradasPanel({ rango, periodoKey }) {
  const [expandidas, setExpandidas] = useState(() => new Set());
  const [operarioFiltro, setOperarioFiltro] = useState('todos');

  const toggleExpandida = (id) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['contabilidad-notas-cerradas', periodoKey],
    queryFn: async () => {
      // ciclo_mes es "YYYY-MM": comparación lexicográfica válida como rango de fechas.
      const cicloDesde = (rango.inicio || '').slice(0, 7);
      const cicloHasta = (rango.fin || '').slice(0, 7);
      const list = await base44.entities.NotaMensualGasto.filter({
        estado: { $in: ESTADOS_CERRADOS },
        ciclo_mes: { $gte: cicloDesde, $lte: cicloHasta },
      }, '-ciclo_mes', 300);
      return list;
    },
  });

  const operariosDisponibles = useMemo(() => {
    const nombres = new Set(notas.map(n => n.operario_name).filter(Boolean));
    return Array.from(nombres).sort();
  }, [notas]);

  const notasFiltradas = useMemo(() => {
    if (operarioFiltro === 'todos') return notas;
    return notas.filter(n => n.operario_name === operarioFiltro);
  }, [notas, operarioFiltro]);

  // IDs de registros para consultar conciliación agregada (solo de las notas visibles tras filtrar)
  const todosIds = useMemo(() => notasFiltradas.flatMap(n => n.registros_ids || []), [notasFiltradas]);

  const { data: registrosMap = {} } = useQuery({
    queryKey: ['contabilidad-notas-registros', periodoKey, todosIds.join(',')],
    queryFn: async () => {
      if (!todosIds.length) return {};
      const got = await Promise.all(todosIds.map(id => base44.entities.RegistroGasto.get(id).catch(() => null)));
      const map = {};
      got.filter(Boolean).forEach(r => { map[r.id] = r; });
      return map;
    },
    enabled: todosIds.length > 0,
  });

  const abrirTicket = (r, e) => {
    e.stopPropagation();
    const archivo = (r.archivos && r.archivos.length > 0) ? r.archivos[0] : null;
    const url = archivo?.url || archivo?.file_url || null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {notasFiltradas.length} nota(s) cerrada(s) en el periodo <span className="font-medium text-foreground">{rango.etiqueta}</span>. Cada nota agrupa los registros verificados/aprobados que se entregan a la gestoría.
        </p>
        {operariosDisponibles.length > 0 && (
          <MobileSelect value={operarioFiltro} onValueChange={setOperarioFiltro} triggerClassName="w-56" placeholder="Filtrar por operario">
            <MobileSelectItem value="todos">Todos los operarios ({notas.length})</MobileSelectItem>
            {operariosDisponibles.map(nombre => (
              <MobileSelectItem key={nombre} value={nombre}>{nombre}</MobileSelectItem>
            ))}
          </MobileSelect>
        )}
      </div>

      {notasFiltradas.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No hay notas de gastos cerradas en este periodo{operarioFiltro !== 'todos' ? ' para este operario' : ''}.
        </Card>
      )}

      {notasFiltradas.map(nota => {
        const regs = (nota.registros_ids || []).map(id => registrosMap[id]).filter(Boolean);
        const conciliados = regs.filter(r => r?.estado_conciliacion === 'conciliado' || r?.estado_conciliacion === 'conciliado_con_discrepancia').length;
        const abierta = expandidas.has(nota.id);
        return (
          <Card key={nota.id} className="p-4 space-y-3">
            <div
              className="flex items-start justify-between gap-3 flex-wrap cursor-pointer select-none"
              onClick={() => toggleExpandida(nota.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpandida(nota.id); }}
            >
              <div className="flex items-start gap-2">
                {abierta ? <ChevronDown className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-primary">{nota.numero_ciclo || nota.ciclo_mes || '—'}</span>
                    <Badge className={`text-[10px] border ${ESTADO_STYLE[nota.estado] || ESTADO_STYLE.borrador}`}>{nota.estado}</Badge>
                  </div>
                  <p className="text-sm font-medium mt-0.5">{nota.operario_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Ciclo: {nota.ciclo_mes || '—'} · Cierre: {nota.fecha_cierre || '—'} · {nota.total_registros || regs.length} registros
                  </p>
                </div>
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
                <a href={nota.export_contabilidad_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Índice PDF exportado
                </a>
              )}
            </div>

            {abierta && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {regs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No se pudieron cargar los registros de este ciclo.</p>
                ) : regs.map(r => {
                  const tieneArchivo = !!(r.archivos && r.archivos.length > 0 && (r.archivos[0].url || r.archivos[0].file_url));
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded border-b border-border/40 last:border-0 ${tieneArchivo ? 'cursor-pointer hover:bg-accent/40' : ''}`}
                      onClick={tieneArchivo ? (e) => abrirTicket(r, e) : undefined}
                      title={tieneArchivo ? 'Ver ticket adjunto' : 'Sin archivo adjunto'}
                    >
                      <div className="min-w-0 flex items-center gap-1.5">
                        {tieneArchivo && <Receipt className="w-3 h-3 text-primary shrink-0" />}
                        <span className="font-mono text-[10px] text-primary">{r.numero_nota || '—'}</span>
                        <span className="truncate">{r.nombre_comercio || '—'}</span>
                        <span className="text-muted-foreground">{r.fecha_documento || ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ConciliacionBadge nota={r} />
                        <span className="font-medium">{(r.importe || 0).toFixed(2)} €</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
