import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Package } from 'lucide-react';

export default function MaterialFields({ materials, onChange }) {
  const addMaterial = () => {
    onChange([...materials, { name: '', quantity: 0, unit: '' }]);
  };

  const removeMaterial = (index) => {
    onChange(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index, field, value) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Package className="w-4 h-4 text-primary" />
          Materiales
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
        {materials.map((material, index) => (
          <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
            <Input
              placeholder="Material"
              value={material.name}
              onChange={(e) => updateMaterial(index, 'name', e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Cantidad"
              value={material.quantity || ''}
              onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
              className="w-24 h-8 text-sm"
              min="0"
            />
            <Input
              placeholder="Ud."
              value={material.unit}
              onChange={(e) => updateMaterial(index, 'unit', e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeMaterial(index)}
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}