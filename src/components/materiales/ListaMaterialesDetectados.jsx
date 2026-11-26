import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

/**
 * Lista editable de materiales detectados en un documento.
 * Cada fila se puede excluir, corregir en descripción/cantidad/unidad/prioridad.
 */
export default function ListaMaterialesDetectados({ items = [], onChange }) {
  const actualizar = (id, cambios) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  };

  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div
          key={it.id}
          className={`rounded-lg border p-2 space-y-1.5 ${it.incluido ? 'bg-background' : 'bg-muted/40 opacity-60'}`}
        >
          <div className="flex items-start gap-2">
            <Checkbox
              checked={it.incluido}
              onCheckedChange={(v) => actualizar(it.id, { incluido: Boolean(v) })}
              className="mt-1.5 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                value={it.descripcion}
                onChange={(e) => actualizar(it.id, { descripcion: e.target.value })}
                className="h-8 text-sm"
              />
              <div className="grid grid-cols-[70px_1fr_1fr] gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={it.cantidad}
                  onChange={(e) => actualizar(it.id, { cantidad: e.target.value })}
                  className="h-7 text-xs px-2"
                />
                <Input
                  value={it.unidad}
                  onChange={(e) => actualizar(it.id, { unidad: e.target.value })}
                  className="h-7 text-xs px-2"
                  placeholder="ud"
                />
                <MobileSelect
                  value={it.prioridad}
                  onValueChange={(v) => actualizar(it.id, { prioridad: v })}
                  triggerClassName="h-7 text-xs"
                >
                  {PRIORIDADES.map((p) => (
                    <MobileSelectItem key={p.value} value={p.value}>{p.label}</MobileSelectItem>
                  ))}
                </MobileSelect>
              </div>
              {(it.referencia || it.observaciones) && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {[it.referencia && `Ref. ${it.referencia}`, it.observaciones].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}