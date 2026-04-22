import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Package, ChevronDown } from 'lucide-react';

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
  const selectFromDB = (i, matId) => {
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
        <Button type="button" variant="outline" size="sm" onClick={addMaterial} className="h-8 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Añadir
        </Button>
      </div>

      {materials.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No hay materiales. Haz clic en "Añadir" para agregar uno.
        </p>
      )}

      <div className="space-y-2">
        {materials.map((mat, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-2.5 space-y-2">
            {/* DB selector */}
            <div className="relative">
              <select
                className="w-full h-8 text-xs rounded-md border border-input bg-transparent px-2 appearance-none pr-7 text-muted-foreground"
                value=""
                onChange={e => selectFromDB(i, e.target.value)}
              >
                <option value="">— Seleccionar del catálogo —</option>
                {catalog.map(m => <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ''}{m.unit_price > 0 ? ` · ${m.unit_price}€` : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {/* Manual fields */}
            <div className="flex items-center gap-2">
              <Input placeholder="Material" value={mat.name} onChange={e => updateMaterial(i, 'name', e.target.value)} className="flex-1 h-8 text-sm" />
              <Input type="number" placeholder="Cantidad" value={mat.quantity || ''} onChange={e => updateMaterial(i, 'quantity', parseFloat(e.target.value) || 0)} className="w-24 h-8 text-sm" min="0" />
              <Input placeholder="Ud." value={mat.unit} onChange={e => updateMaterial(i, 'unit', e.target.value)} className="w-20 h-8 text-sm" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(i)} className="h-8 w-8 shrink-0 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}