import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { Plus, Trash2, Sparkles } from 'lucide-react';

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

export default function ParteTrabajosExtras({ extras, onChange }) {
  const addExtra = () => onChange([...extras, { descripcion: '', importe: '', prioridad: 'media' }]);
  const updateExtra = (i, field, value) => {
    const next = extras.map((e, idx) => (idx === i ? { ...e, [field]: value } : e));
    onChange(next);
  };
  const removeExtra = (i) => onChange(extras.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5 text-amber-800">
          <Sparkles className="w-3.5 h-3.5" /> Trabajos extras solicitados
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addExtra} className="gap-1.5 h-8 px-2">
          <Plus className="w-3.5 h-3.5" /> Añadir
        </Button>
      </div>
      <p className="text-[10px] text-amber-700/80">
        Cada trabajo extra se centraliza por obra en el módulo de <b>Trabajos extras</b>. Gerencia/Administración los revisa y marca como facturados a final de mes.
      </p>

      {extras.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic px-1 py-1.5">No se han añadido trabajos extras.</p>
      )}

      {extras.map((extra, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-amber-100 bg-card p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-amber-700">Trabajo extra #{i + 1}</span>
            <button type="button" onClick={() => removeExtra(i)} className="text-destructive/70 hover:text-destructive p-1 rounded" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2 items-start">
            <Textarea
              value={extra.descripcion}
              onChange={(e) => updateExtra(i, 'descripcion', e.target.value)}
              rows={2}
              placeholder="Describe el trabajo extra solicitado..."
              className="flex-1"
            />
            <VoiceInputButton onResult={(t) => updateExtra(i, 'descripcion', (extra.descripcion ? extra.descripcion + ' ' : '') + t)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Prioridad</Label>
              <MobileSelect
                value={extra.prioridad || 'media'}
                onValueChange={(v) => updateExtra(i, 'prioridad', v)}
                triggerClassName="h-8 text-xs"
              >
                {PRIORIDADES.map((p) => (
                  <MobileSelectItem key={p.value} value={p.value}>{p.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Importe estimado (€) — opcional</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={extra.importe}
                onChange={(e) => updateExtra(i, 'importe', e.target.value)}
                placeholder="0,00"
                className="h-8"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}