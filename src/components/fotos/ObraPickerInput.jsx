/**
 * ObraPickerInput — Selector de obra desde la base de datos con fallback
 * a texto manual para obras no registradas.
 *
 * Props:
 *   obrasMap  — mapa <id, { id, name, client_name, activo }> de useObrasActivasMap
 *   value     — { proyecto_id, proyecto_name }
 *   onChange  — ({ proyecto_id, proyecto_name }) => void
 */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Edit3, Check } from 'lucide-react';

export default function ObraPickerInput({ obrasMap, value, onChange }) {
  const [manual, setManual] = useState(false);

  const obras = useMemo(
    () => Object.values(obrasMap || {}).sort((a, b) => (a.client_name || '').localeCompare(b.client_name || '') || a.name.localeCompare(b.name)),
    [obrasMap],
  );

  const selectedId = value?.proyecto_id || '';

  const handleSelect = (id) => {
    if (!id) { onChange({ proyecto_id: '', proyecto_name: '' }); return; }
    const o = obrasMap[id];
    onChange({ proyecto_id: id, proyecto_name: o?.name || '' });
  };

  const handleManual = (name) => {
    onChange({ proyecto_id: '', proyecto_name: name });
  };

  if (manual) {
    return (
      <div className="space-y-1.5">
        <Input
          value={value?.proyecto_name || ''}
          onChange={e => handleManual(e.target.value)}
          placeholder="Nombre de la obra (no registrada)..."
          autoFocus
        />
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-xs text-primary flex items-center gap-1 hover:underline"
        >
          <Check className="w-3 h-3" /> Seleccionar de la lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <MobileSelect
        value={selectedId}
        onValueChange={handleSelect}
        placeholder="Seleccionar obra..."
      >
        {obras.map(o => (
          <MobileSelectItem key={o.id} value={o.id}>
            {o.client_name ? `${o.client_name} — ${o.name}` : o.name}
          </MobileSelectItem>
        ))}
      </MobileSelect>
      <button
        type="button"
        onClick={() => { setManual(true); onChange({ proyecto_id: '', proyecto_name: value?.proyecto_name || '' }); }}
        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary hover:underline"
      >
        <Edit3 className="w-3 h-3" /> La obra no está registrada (introducir manualmente)
      </button>
    </div>
  );
}