import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const IVAS = [0, 4, 10, 21];

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/** Líneas de una propuesta importada: descripción, cantidad, unidad, precio e IVA. */
export default function LineasPropuestaImportada({ lineas = [], onChange }) {
  const actualizar = (i, patch) => onChange(lineas.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const quitar = (i) => onChange(lineas.filter((_, j) => j !== i));
  const anadir = () => onChange([...lineas, { tipo: 'linea', descripcion: '', cantidad: 1, unidad: 'ud', precio_unitario: 0, iva_pct: 21 }]);

  return (
    <div className="space-y-1.5">
      {lineas.length === 0 && (
        <p className="text-xs text-muted-foreground">El documento no ha devuelto líneas. Añádelas a mano.</p>
      )}

      {lineas.map((l, i) => (
        <div key={i} className="rounded-md border bg-background p-2 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <Input
              value={l.descripcion}
              onChange={(e) => actualizar(i, { descripcion: e.target.value })}
              className="h-9 text-xs flex-1"
              placeholder="Descripción de la línea"
            />
            <Button
              type="button" variant="ghost" size="icon"
              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
              onClick={() => quitar(i)} title="Quitar línea"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {l.tipo === 'linea' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Input
                type="number" step="any" inputMode="decimal"
                value={l.cantidad}
                onChange={(e) => actualizar(i, { cantidad: e.target.value })}
                className="h-9 text-xs" placeholder="Cantidad"
              />
              <Input
                value={l.unidad}
                onChange={(e) => actualizar(i, { unidad: e.target.value })}
                className="h-9 text-xs" placeholder="ud"
              />
              <Input
                type="number" step="any" inputMode="decimal"
                value={l.precio_unitario}
                onChange={(e) => actualizar(i, { precio_unitario: e.target.value })}
                className="h-9 text-xs" placeholder="Precio"
              />
              <Select value={String(l.iva_pct)} onValueChange={(v) => actualizar(i, { iva_pct: Number(v) })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IVAS.map((iva) => <SelectItem key={iva} value={String(iva)}>IVA {iva}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Línea de texto (encabezado o comentario), sin importe.</p>
          )}

          {l.tipo === 'linea' && (
            <p className="text-[11px] text-muted-foreground text-right">
              {eur((Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0))}
            </p>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs w-full" onClick={anadir}>
        <Plus className="w-3 h-3" /> Añadir línea
      </Button>
    </div>
  );
}