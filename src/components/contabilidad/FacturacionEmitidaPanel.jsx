import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ExternalLink, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import SemaforoTrazabilidadBadge from '@/components/contabilidad/SemaforoTrazabilidadBadge';

const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: Clock },
  enviado:   { label: 'Enviado',   color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Clock },
  aceptado:  { label: 'Aceptado',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700 border-red-200',           icon: XCircle },
};

/**
 * Facturación emitida — el ingreso simétrico al gasto. Lista los Presupuesto
 * del periodo como facturación emitida (aceptados = ingreso confirmado).
 */
export default function FacturacionEmitidaPanel({ rango, periodoKey }) {
  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['contabilidad-facturacion', periodoKey],
    queryFn: async () => {
      const list = await base44.entities.Presupuesto.filter({
        fecha: { $gte: rango.inicio, $lte: rango.fin },
      }, '-fecha', 200);
      return list;
    },
  });

  const totals = useMemo(() => {
    const total = presupuestos.reduce((s, p) => s + (p.importe || 0), 0);
    const aceptado = presupuestos.filter(p => p.estado === 'aceptado').reduce((s, p) => s + (p.importe || 0), 0);
    const pendiente = presupuestos.filter(p => p.estado === 'enviado').reduce((s, p) => s + (p.importe || 0), 0);
    return { total, aceptado, pendiente, count: presupuestos.length };
  }, [presupuestos]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Facturación emitida</p>
          <p className="text-lg font-bold">{totals.total.toFixed(2)} €</p>
          <p className="text-[10px] text-muted-foreground">{totals.count} presupuesto(s)</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Aceptado (ingreso)</p>
          <p className="text-lg font-bold text-emerald-600">{totals.aceptado.toFixed(2)} €</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Enviado (pendiente)</p>
          <p className="text-lg font-bold text-blue-600">{totals.pendiente.toFixed(2)} €</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Periodo</p>
          <p className="text-lg font-bold">{rango.etiqueta}</p>
        </Card>
      </div>

      {presupuestos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No hay facturación emitida en este periodo.</Card>
      ) : (
        <div className="space-y-2">
          {presupuestos.map(p => {
            const cfg = ESTADO_CFG[p.estado] || ESTADO_CFG.borrador;
            const Icon = cfg.icon;
            return (
              <Card key={p.id} className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-xs font-bold text-primary">{p.codigo_registro || '—'}</span>
                    <Badge className={`text-[10px] border ${cfg.color}`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                    {/* Semáforo reutilizado: para Presupuesto, la "conciliación" = aceptado */}
                    <SemaforoTrazabilidadBadge doc={{ estado_conciliacion: p.estado === 'aceptado' ? 'conciliado' : 'no_conciliado', estado: p.estado === 'enviado' ? 'pendiente' : p.estado }} showLabel={false} />
                  </div>
                  <p className="text-sm font-medium truncate">
                    {p.titulo || p.cliente_name || 'Sin cliente'}
                    {p.cliente_name && p.titulo && <span className="text-xs text-muted-foreground ml-1.5">· {p.cliente_name}</span>}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {p.fecha && <span>📅 {p.fecha}</span>}
                    {p.conceptos?.length > 0 && <span>📋 {p.conceptos.length} líneas</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-base font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    {(p.importe || 0).toFixed(2)} €
                  </span>
                  {p.file_url && (
                    <a href={p.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> PDF
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}