import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Plus, Trash2, Package } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';

export default function MaterialFields({ materials, onChange }) {
  const { data: catalog = [] } = useQuery({
    queryKey: ['material_catalog'],
    queryFn: () => base44.entities.MaterialCatalog.list('name', 500),
  });

  const addMaterial = () => onChange([...materials, { name: '', quantity: 0, unit: '' }]);
  const removeMaterial = (i) => onChange(materials.filter((_, idx) => idx !== i));
  const updateMaterial = (i, field, value) => {
    const updated = [...materials];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };
  const selectFromCatalog = (i, matId) => {
    if (!matId) return;
    const mat = catalog.find(m => m.id === matId);
    if (!mat) return;
    const updated = [...materials];
    updated[i] = { ...updated[i], name: mat.name, unit: mat.unit || updated[i].unit };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Package className="w-4 h-4 text-primary" /> Materiales
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addMaterial} className="h-9 px-4 text-sm gap-1">
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      {materials.length === 0 && (
        <button
          type="button"
          onClick={addMaterial}
          className="w-full text-xs text-muted-foreground text-center py-5 border border-dashed rounded-xl hover:bg-muted/40 transition-colors"
        >
          Toca para añadir materiales
        </button>
      )}

      <div className="space-y-2">
        {materials.map((mat, i) => (
          <div key={i} className="bg-muted/50 rounded-xl p-3 space-y-2.5">
            {/* Catalog picker */}
            {catalog.length > 0 && (
              <MobileSelect
                value=""
                onValueChange={v => selectFromCatalog(i, v)}
                placeholder="— Seleccionar del catálogo —"
              >
                {catalog.map(m => (
                  <MobileSelectItem key={m.id} value={m.id}>
                    {m.name}{m.unit ? ` (${m.unit})` : ''}{m.unit_price > 0 ? ` · ${m.unit_price}€` : ''}
                  </MobileSelectItem>
                ))}
              </MobileSelect>
            )}
            {/* Manual fields */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Material"
                value={mat.name}
                onChange={e => updateMaterial(i, 'name', e.target.value)}
                className="flex-1 h-10"
              />
              <VoiceInputButton onResult={txt => updateMaterial(i, 'name', txt)} />
              <Input
                type="number"
                placeholder="Cant."
                value={mat.quantity || ''}
                onChange={e => updateMaterial(i, 'quantity', parseFloat(e.target.value) || 0)}
                className="w-20 h-10"
                min="0"
              />
              <Input
                placeholder="Ud."
                value={mat.unit}
                onChange={e => updateMaterial(i, 'unit', e.target.value)}
                className="w-16 h-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeMaterial(i)}
                className="h-10 w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}