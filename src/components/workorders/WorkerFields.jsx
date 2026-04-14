import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users } from 'lucide-react';

export default function WorkerFields({ workers, onChange }) {
  const addWorker = () => {
    onChange([...workers, { name: '', hours: 0, role: '' }]);
  };

  const removeWorker = (index) => {
    onChange(workers.filter((_, i) => i !== index));
  };

  const updateWorker = (index, field, value) => {
    const updated = [...workers];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-primary" />
          Operarios
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addWorker} className="h-8 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Añadir
        </Button>
      </div>

      {workers.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No hay operarios. Haz clic en "Añadir" para agregar uno.
        </p>
      )}

      <div className="space-y-2">
        {workers.map((worker, index) => (
          <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
            <Input
              placeholder="Nombre"
              value={worker.name}
              onChange={(e) => updateWorker(index, 'name', e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Input
              placeholder="Rol"
              value={worker.role}
              onChange={(e) => updateWorker(index, 'role', e.target.value)}
              className="w-28 h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Horas"
              value={worker.hours || ''}
              onChange={(e) => updateWorker(index, 'hours', parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              min="0"
              step="0.5"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeWorker(index)}
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