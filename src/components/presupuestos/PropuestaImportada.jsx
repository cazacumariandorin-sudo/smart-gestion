import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import LineasPropuestaImportada from './LineasPropuestaImportada';
import { NUEVO_CLIENTE } from '@/lib/importarPresupuestoExterno';

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const ETIQUETA_TIPO = { presupuesto: 'Presupuesto externo', factura: 'Factura externa', otro: 'Documento' };

/** Revisión de un documento importado antes de crear el presupuesto. */
export default function PropuestaImportada({ propuesta, clientes = [], onChange, onRemove, onVerDocumento }) {
  const p = propuesta;

  const totales = useMemo(() => {
    return (p.lineas || []).reduce((acc, l) => {
      if (l.tipo === 'texto') return acc;
      const base = (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0);
      acc.base += base;
      acc.iva += (base * (Number(l.iva_pct) || 0)) / 100;
      return acc;
    }, { base: 0, iva: 0 });
  }, [p.lineas]);

  const total = totales.base + totales.iva;
  const descuadre = p.total_documento > 0 && Math.abs(p.total_documento - total) > 0.05;

  const cambiarCliente = (value) => {
    if (value === NUEVO_CLIENTE) {
      onChange({ cliente_id: NUEVO_CLIENTE });
      return;
    }
    const cliente = clientes.find((c) => c.id === value);
    onChange({ cliente_id: value, cliente_nombre: cliente?.name || p.cliente_nombre });
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Cabecera del documento */}
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{p.archivo?.nombre || 'Documento'}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Badge variant="outline" className="text-[10px]">{ETIQUETA_TIPO[p.tipo_documento] || 'Documento'}</Badge>
            {p.numero_documento && <span className="text-[11px] text-muted-foreground">{p.numero_documento}</span>}
          </div>
        </div>
        {p.archivo?.url && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onVerDocumento} title="Ver documento original">
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onRemove} title="Descartar">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Cabecera editable */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-muted-foreground">Título</label>
          <Input value={p.titulo} onChange={(e) => onChange({ titulo: e.target.value })} className="h-9 text-sm" placeholder="Objeto del presupuesto" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Cliente *</label>
          <Select value={p.cliente_id || undefined} onValueChange={cambiarCliente}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
            <SelectContent>
              {p.cliente_nombre && (
                <SelectItem value={NUEVO_CLIENTE}>Crear cliente «{p.cliente_nombre}»</SelectItem>
              )}
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {p.cliente_id === NUEVO_CLIENTE && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Se dará de alta el cliente «{p.cliente_nombre}»{p.cliente_nif ? ` (${p.cliente_nif})` : ''}.
            </p>
          )}
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Fecha</label>
          <Input type="date" value={p.fecha} onChange={(e) => onChange({ fecha: e.target.value })} className="h-9 text-sm" />
        </div>
      </div>

      {/* Líneas */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold">Líneas ({p.lineas?.length || 0})</p>
        <LineasPropuestaImportada lineas={p.lineas || []} onChange={(lineas) => onChange({ lineas })} />
      </div>

      {/* Totales */}
      <div className="rounded-md bg-muted/40 p-2 space-y-0.5 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Base imponible</span><span className="font-medium">{eur(totales.base)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span className="font-medium">{eur(totales.iva)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{eur(total)}</span></div>
        {descuadre && (
          <p className="flex items-start gap-1 text-[11px] text-orange-600 pt-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            El documento indica un total de {eur(p.total_documento)}. Revisa las líneas o los precios.
          </p>
        )}
      </div>

      {p.datos_no_disponibles?.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          No consta en el documento: {p.datos_no_disponibles.join(' · ')}
        </p>
      )}
    </div>
  );
}