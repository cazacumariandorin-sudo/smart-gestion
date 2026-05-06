import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Plus, Trash2, Users } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';

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
    if (!opId) return;
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
        <Button type="button" variant="outline" size="sm" onClick={addWorker} className="h-9 px-4 text-sm gap-1">
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      {workers.length === 0 && (
        <button
          type="button"
          onClick={addWorker}
          className="w-full text-xs text-muted-foreground text-center py-5 border border-dashed rounded-xl hover:bg-muted/40 transition-colors"
        >
          Toca para añadir operarios
        </button>
      )}

      <div className="space-y-2">
        {workers.map((worker, i) => (
          <div key={i} className="bg-muted/50 rounded-xl p-3 space-y-2.5">
            {/* DB selector */}
            {operarios.length > 0 && (
              <MobileSelect
                value=""
                onValueChange={v => selectFromDB(i, v)}
                placeholder="— Seleccionar de base de datos —"
              >
                {operarios.map(op => (
                  <MobileSelectItem key={op.id} value={op.id}>
                    {op.name}{op.role ? ` (${op.role})` : ''}
                  </MobileSelectItem>
                ))}
              </MobileSelect>
            )}
            {/* Manual fields */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nombre"
                value={worker.name}
                onChange={e => updateWorker(i, 'name', e.target.value)}
                className="flex-1 h-10"
              />
              <VoiceInputButton onResult={txt => updateWorker(i, 'name', txt)} />
              <Input
                placeholder="Rol"
                value={worker.role}
                onChange={e => updateWorker(i, 'role', e.target.value)}
                className="w-24 h-10"
              />
              <Input
                type="number"
                placeholder="Horas"
                value={worker.hours || ''}
                onChange={e => updateWorker(i, 'hours', parseFloat(e.target.value) || 0)}
                className="w-20 h-10"
                min="0"
                step="0.5"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeWorker(i)}
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