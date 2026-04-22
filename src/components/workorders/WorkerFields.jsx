import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, ChevronDown } from 'lucide-react';

export default function WorkerFields({ workers, onChange }) {
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const addWorker = () => onChange([...workers, { name: '', hours: 0, role: '' }]);
  const removeWorker = (i) => onChange(workers.filter((_, idx) => idx !== i));
  const updateWorker = (i, field, value) => {
    const updated = [...workers];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };
  const selectFromDB = (i, opId) => {
    const op = operarios.find(o => o.id === opId);
    if (!op) return;
    const updated = [...workers];
    updated[i] = { ...updated[i], name: op.name, role: op.role || updated[i].role };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-primary" /> Operarios
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
        {workers.map((worker, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-2.5 space-y-2">
            {/* DB selector */}
            <div className="relative">
              <select
                className="w-full h-8 text-xs rounded-md border border-input bg-transparent px-2 appearance-none pr-7 text-muted-foreground"
                value=""
                onChange={e => selectFromDB(i, e.target.value)}
              >
                <option value="">— Seleccionar de base de datos —</option>
                {operarios.map(op => <option key={op.id} value={op.id}>{op.name}{op.role ? ` (${op.role})` : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {/* Manual fields */}
            <div className="flex items-center gap-2">
              <Input placeholder="Nombre" value={worker.name} onChange={e => updateWorker(i, 'name', e.target.value)} className="flex-1 h-8 text-sm" />
              <Input placeholder="Rol" value={worker.role} onChange={e => updateWorker(i, 'role', e.target.value)} className="w-28 h-8 text-sm" />
              <Input type="number" placeholder="Horas" value={worker.hours || ''} onChange={e => updateWorker(i, 'hours', parseFloat(e.target.value) || 0)} className="w-20 h-8 text-sm" min="0" step="0.5" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeWorker(i)} className="h-8 w-8 shrink-0 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}