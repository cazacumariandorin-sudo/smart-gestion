import { useState } from 'react';
import { Download, Loader2, Pencil, FileText, AlertTriangle, Package } from 'lucide-react';
import SimantecLogo from '@/components/SimantecLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportarPedidoPdf } from '@/lib/exportarPedidoPdf';
import PedidoDocumentoOriginal from './PedidoDocumentoOriginal';

const statusCfg = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_curso: { label: 'En curso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  entregado: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-200' },
};

/**
 * Vista de presentación corporativa de un pedido (identidad Simantec).
 * Es una VISTA (no edita): el diálogo de edición existente sigue siendo el
 * mecanismo de modificación. Recibe `order` y `showPrices` (permisos admin).
 */
export default function PedidoVistaCorporativa({ order, showPrices = false, onEdit }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!order) return null;

  const cfg = statusCfg[order.estado] || statusCfg.pendiente;
  const importeTotal = (order.items || []).reduce(
    (s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0
  ) || order.importe || 0;

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      exportarPedidoPdf(order, showPrices);
    } catch (e) {
      console.error('Error generando PDF del pedido:', e);
    } finally {
      setPdfLoading(false);
    }
  };

  const fmtFecha = (f) => f ? format(parseISO(f), "d MMM yyyy", { locale: es }) : '—';

  return (
    <div className="pedido-print-area border-t border-border bg-background">
      {/* Cabecera corporativa */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <SimantecLogo size={36} showTagline={false} />
          <div className="leading-tight">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">PEDIDO</p>
            <p className="font-mono text-sm font-bold text-foreground">{order.title || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="outline" className={`${cfg.className} text-xs`}>{cfg.label}</Badge>
          <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={handlePdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Datos del pedido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4 border-b border-border bg-card/40">
        <Dato label="Obra" value={order.obra_name} destacada />
        <Dato label="Proveedor" value={order.proveedor} />
        <Dato label="Fecha pedido" value={fmtFecha(order.fecha_pedido)} />
        <Dato label="Entrega prevista" value={fmtFecha(order.fecha_entrega)} accent="amber" />
      </div>

      {/* Tabla de líneas */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground tracking-wide">LÍNEAS DEL PEDIDO</p>
        </div>
        {(!order.items || order.items.length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
            Sin líneas en este pedido.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-primary/10 text-primary-foreground/80">
                  <th className="text-left font-semibold px-3 py-2">Descripción</th>
                  <th className="text-right font-semibold px-3 py-2 w-20">Cantidad</th>
                  <th className="text-left font-semibold px-3 py-2 w-16">Unidad</th>
                  {showPrices && <th className="text-right font-semibold px-3 py-2 w-24">Precio</th>}
                  {showPrices && <th className="text-right font-semibold px-3 py-2 w-24">Subtotal</th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} className="border-t border-border odd:bg-background even:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{item.nombre || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.cantidad || 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.unidad || ''}</td>
                    {showPrices && <td className="px-3 py-2 text-right tabular-nums">{(item.precio || 0).toFixed(2)} €</td>}
                    {showPrices && (
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {((item.cantidad || 0) * (item.precio || 0)).toFixed(2)} €
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {showPrices && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td colSpan={4} className="px-3 py-2 text-right font-semibold text-muted-foreground">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-primary tabular-nums">{importeTotal.toFixed(2)} €</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Notas */}
      {order.notas && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVACIONES</p>
          <p className="text-xs text-foreground/90 italic bg-muted/30 rounded-lg px-3 py-2 border border-border/60">
            {order.notas}
          </p>
        </div>
      )}

      {/* Documento original vs líneas extraídas */}
      {order.file_url && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground tracking-wide">VER DOCUMENTO ORIGINAL</p>
          </div>
          <PedidoDocumentoOriginal
            fileUrl={order.file_url}
            items={order.items}
            showPrices={showPrices}
          />
        </div>
      )}
    </div>
  );
}

function Dato({ label, value, destacada, accent }) {
  const accentClass = accent === 'amber' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm truncate ${destacada ? 'font-bold' : 'font-medium'} ${accentClass}`}>
        {value || '—'}
      </p>
    </div>
  );
}