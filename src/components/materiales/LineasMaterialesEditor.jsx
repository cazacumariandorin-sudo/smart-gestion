import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/ui-utils';

const UNIDADES = ['ud', 'm', 'm²', 'm³', 'kg', 'ml', 'l', 'h', 'día', 'mes', 'caja', 'paquete'];

const CAMPOS = [
  { key: 'fabricante', label: 'Fabricante', width: 'w-32' },
  { key: 'referencia', label: 'Referencia', width: 'w-24' },
  { key: 'descripcion', label: 'Descripción', width: 'flex-1 min-w-[180px]' },
  { key: 'cantidad', label: 'Cant.', width: 'w-16', type: 'number' },
  { key: 'unidad', label: 'Ud', width: 'w-20' },
  { key: 'pvp', label: 'PVP', width: 'w-20', type: 'number' },
  { key: 'descuento_empresa', label: 'Dto %', width: 'w-16', type: 'number' },
  { key: 'iva', label: 'IVA %', width: 'w-16', type: 'number' },
  { key: 'precio_neto', label: 'Precio neto', width: 'w-24', type: 'number' },
];

export default function LineasMaterialesEditor({ lineas: initial, onChange }) {
  const [lineas, setLineas] = useState(() => (initial || []).map(l => ({ incluir: true, ...l })));

  const update = (idx, key, value) => {
    setLineas(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      onChange?.(next);
      return next;
    });
  };

  const addLinea = () => {
    const nueva = { incluir: true, fabricante: '', referencia: '', descripcion: '', cantidad: 1, unidad: 'ud', pvp: '', descuento_empresa: '', iva: '', precio_neto: '' };
    setLineas(prev => { const n = [...prev, nueva]; onChange?.(n); return n; });
  };

  const removeLinea = (idx) => {
    setLineas(prev => { const n = prev.filter((_, i) => i !== idx); onChange?.(n); return n; });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Revisa y corrige las líneas extraídas antes de guardarlas en Materiales.
          Desactiva <span className="font-semibold">"Incluir"</span> para las que no apliquen.
        </p>
        <Button size="sm" variant="outline" onClick={addLinea} className="gap-1.5 h-8">
          <Plus className="w-3.5 h-3.5" /> Añadir línea
        </Button>
      </div>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {lineas.map((linea, idx) => (
          <div
            key={idx}
            className={cn(
              'rounded-lg border p-2.5 grid grid-cols-12 gap-2 items-center',
              linea.incluir ? 'bg-card border-border' : 'bg-muted/40 border-muted opacity-60'
            )}
          >
            <label className="col-span-12 sm:col-span-1 flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={!!linea.incluir}
                onChange={e => update(idx, 'incluir', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
            </label>

            <div className="col-span-12 sm:col-span-11 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="space-y-0.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] text-muted-foreground">Fabricante</Label>
                <Input value={linea.fabricante || ''} onChange={e => update(idx, 'fabricante', e.target.value)} className="h-8 text-xs" placeholder="Marca" />
              </div>
              <div className="space-y-0.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] text-muted-foreground">Referencia</Label>
                <Input value={linea.referencia || ''} onChange={e => update(idx, 'referencia', e.target.value)} className="h-8 text-xs font-mono" placeholder="Cód." />
              </div>
              <div className="space-y-0.5 col-span-2 sm:col-span-2">
                <Label className="text-[10px] text-muted-foreground">Descripción</Label>
                <Input value={linea.descripcion || ''} onChange={e => update(idx, 'descripcion', e.target.value)} className="h-8 text-xs" placeholder="Producto" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Cant.</Label>
                <Input type="number" value={linea.cantidad ?? ''} onChange={e => update(idx, 'cantidad', e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Ud</Label>
                <Input value={linea.unidad || ''} onChange={e => update(idx, 'unidad', e.target.value)} className="h-8 text-xs" list="uds-list" placeholder="ud" />
                <datalist id="uds-list">
                  {UNIDADES.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">PVP</Label>
                <Input type="number" value={linea.pvp ?? ''} onChange={e => update(idx, 'pvp', e.target.value)} className="h-8 text-xs" placeholder="0.00" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Dto %</Label>
                <Input type="number" value={linea.descuento_empresa ?? ''} onChange={e => update(idx, 'descuento_empresa', e.target.value)} className="h-8 text-xs" placeholder="0" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">IVA %</Label>
                <Input type="number" value={linea.iva ?? ''} onChange={e => update(idx, 'iva', e.target.value)} className="h-8 text-xs" placeholder="21" />
              </div>
              <div className="space-y-0.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] text-muted-foreground font-semibold">Precio neto *</Label>
                <Input type="number" step="0.01" value={linea.precio_neto ?? ''} onChange={e => update(idx, 'precio_neto', e.target.value)} className="h-8 text-xs font-semibold" placeholder="0.00" />
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end">
                <Button size="icon" variant="ghost" onClick={() => removeLinea(idx)} className="h-8 w-8 text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {lineas.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No hay líneas detectadas. Puedes añadirlas manualmente con "Añadir línea".
          </div>
        )}
      </div>
    </div>
  );
}