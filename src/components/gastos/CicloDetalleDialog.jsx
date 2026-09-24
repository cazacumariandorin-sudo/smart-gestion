import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ExternalLink, Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';

const ESTADO_LABELS = {
  borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada',
  en_contabilidad: 'En contabilidad', pagada: 'Pagada', rechazada: 'Rechazada',
};
const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200',
  enviada: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobada: 'bg-amber-50 text-amber-700 border-amber-200',
  en_contabilidad: 'bg-purple-50 text-purple-700 border-purple-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};
const CATEGORIA_LABELS = {
  material: 'Material', combustible: 'Combustible', peaje: 'Peaje',
  parking: 'Parking', comida: 'Comida', otros: 'Otros',
};

const eur = (n) => `${(n || 0).toFixed(2)} €`;

export default function CicloDetalleDialog({ nota, open, onClose }) {
  const { role } = useUserRole();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['nota_mensual_detalle', nota?.id],
    queryFn: () => base44.entities.RegistroGasto.filter({ nota_mensual_id: nota.id }, '-fecha_documento', 200),
    enabled: !!nota?.id && open,
  });

  // Adelantos reales del ciclo (entidad Adelanto, tipo=gastos, estados activos)
  const { data: adelantosCiclo = [] } = useQuery({
    queryKey: ['nota_mensual_adelantos', nota?.ciclo_mes, nota?.operario_id],
    queryFn: () => base44.entities.Adelanto.filter({
      ciclo_mes: nota.ciclo_mes,
      operario_id: nota.operario_id,
    }),
    enabled: !!nota?.id && open,
  });

  const adelantosActivos = useMemo(() =>
    (adelantosCiclo || []).filter(a => a.tipo === 'gastos' &&
      ['entregado', 'justificado', 'parcialmente_justificado'].includes(a.estado)),
    [adelantosCiclo]);

  const resumen = useMemo(() => {
    const totalGastos = registros.reduce((s, r) => s + (r.importe || 0), 0);
    const totalAdelantos = adelantosActivos.reduce((s, a) => s + (a.importe || 0), 0);
    return { totalGastos, num: registros.length, totalAdelantos };
  }, [registros, adelantosActivos]);

  if (!nota) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {nota.numero_ciclo || nota.ciclo_mes}
            </span>
            <span>{nota.operario_name || '—'}</span>
            <Badge variant="outline" className={ESTADO_COLORS[nota.estado] || ESTADO_COLORS.borrador}>
              {ESTADO_LABELS[nota.estado] || nota.estado || 'Borrador'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Ciclo {nota.ciclo_mes} · {resumen.num} registro{resumen.num === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>

        {/* Resumen económico */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="font-bold">{eur(nota.total_importe || resumen.totalGastos)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="text-xs text-muted-foreground">Adelantos</p>
            <p className="font-bold text-amber-700">{eur(nota.total_adelantos_gastos || nota.importe_adelanto || 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="text-xs text-muted-foreground">Neto a liquidar</p>
            <p className="font-bold text-primary">{eur(nota.importe_neto_liquidar ?? nota.saldo_pendiente ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <p className={`font-bold ${(nota.saldo_pendiente ?? 0) > 0 ? 'text-amber-700' : ''}`}>{eur(nota.saldo_pendiente ?? 0)}</p>
          </div>
        </div>

        {/* Datos administrativos */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {nota.fecha_apertura && <span>Apertura: {nota.fecha_apertura}</span>}
          {nota.fecha_cierre && <span>Cierre: {nota.fecha_cierre}</span>}
          {nota.aprobado_por && <span>Aprobado por: {nota.aprobado_por}</span>}
          {nota.pagado_por && <span>Pagado por: {nota.pagado_por} ({nota.fecha_pago})</span>}
          {nota.metodo_pago && <span>Método: {nota.metodo_pago}</span>}
        </div>

        {nota.export_contabilidad_url && (
          <a
            href={nota.export_contabilidad_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-700 hover:underline w-fit"
          >
            <ExternalLink className="w-4 h-4" /> Abrir exportación a contabilidad
          </a>
        )}

        {/* Adelantos del ciclo */}
        {adelantosActivos.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Adelantos del ciclo ({adelantosActivos.length})
            </p>
            {adelantosActivos.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-sm bg-white/60 rounded px-2.5 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{a.concepto || 'Adelanto'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.fecha_entrega || '—'} · {a.estado}
                  </p>
                </div>
                <span className="font-semibold text-amber-700 shrink-0">{eur(a.importe)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Listado de registros */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando registros…
            </div>
          ) : registros.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No hay registros vinculados a este ciclo.
            </div>
          ) : (
            <div className="space-y-1.5">
              {registros.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{r.nombre_comercio || r.concepto || 'Sin descripción'}</p>
                    <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                      <span>{r.fecha_documento || '—'}</span>
                      {r.categoria && <span>· {CATEGORIA_LABELS[r.categoria] || r.categoria}</span>}
                      {r.obra_name && <span className="truncate">· {r.obra_name}</span>}
                    </p>
                  </div>
                  <span className="font-semibold shrink-0">{eur(r.importe)}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{r.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}