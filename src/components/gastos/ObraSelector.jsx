import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Sun, PenLine } from 'lucide-react';

export default function ObraSelector({ value, obraName, obraTipo, onChange }) {
  const [modo, setModo] = useState('lista'); // lista | manual

  const { data: obras = [] } = useQuery({
    queryKey: ['obras_selector'],
    queryFn: () => base44.entities.Obra.list('name', 200),
  });
  const { data: solares = [] } = useQuery({
    queryKey: ['solar_selector'],
    queryFn: () => base44.entities.SolarObra.list('name', 200),
  });

  const todasObras = [
    ...obras.filter(o => o.status !== 'finalizada').map(o => ({ id: o.id, name: o.name, tipo: 'obra' })),
    ...solares.filter(o => o.status !== 'finalizada').map(o => ({ id: o.id, name: o.name, tipo: 'solar' })),
  ];

  const handleSelect = (val) => {
    if (val === '__manual__') {
      setModo('manual');
      onChange({ obra_id: null, obra_name: '', obra_tipo: 'manual' });
    } else {
      const obra = todasObras.find(o => o.id === val);
      if (obra) onChange({ obra_id: obra.id, obra_name: obra.name, obra_tipo: obra.tipo });
    }
  };

  if (modo === 'manual') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Obra (entrada manual)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la obra"
            value={obraName || ''}
            onChange={e => onChange({ obra_id: null, obra_name: e.target.value, obra_tipo: 'manual' })}
          />
          <button
            type="button"
            onClick={() => setModo('lista')}
            className="text-xs text-primary underline whitespace-nowrap px-1"
          >
            Buscar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Obra (opcional)</Label>
      <MobileSelect
        value={value || ''}
        onValueChange={handleSelect}
        placeholder="Seleccionar obra..."
      >
        {todasObras.map(o => (
          <MobileSelectItem key={o.id} value={o.id}>
            {o.tipo === 'solar' ? '☀️ ' : '🏗️ '}{o.name}
          </MobileSelectItem>
        ))}
        <MobileSelectItem value="__manual__">
          ✏️ Introducir manualmente
        </MobileSelectItem>
      </MobileSelect>
    </div>
  );
}