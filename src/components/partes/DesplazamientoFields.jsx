/**
 * DesplazamientoFields — Bloque OPCIONAL para registrar el vehículo y el
 * desplazamiento realizado en un parte de trabajo o parte diario.
 * No bloquea el guardado: si está vacío, el parte se crea igual.
 *
 * Props:
 *   value: { vehiculo_id, vehiculo_matricula, desplazamiento_tipo, desplazamiento_valor }
 *   onChange: (partial) => void
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car } from 'lucide-react';

const TIPOS = [
  { value: 'desplazamiento', label: 'Desplazamiento a obra' },
  { value: 'traslado', label: 'Traslado entre obras' },
  { value: 'compras', label: 'Compra de materiales' },
  { value: 'otro', label: 'Otro' },
];

export default function DesplazamientoFields({ value = {}, onChange }) {
  const { data: vehiculos = [] } = useQuery({
    queryKey: ['vehiculos-desplazamiento'],
    queryFn: () => base44.entities.Vehiculo.list('matricula', 200),
    staleTime: 5 * 60 * 1000,
  });

  const set = (patch) => onChange?.(patch);

  const handleVehiculo = (vehiculoId) => {
    if (!vehiculoId) { set({ vehiculo_id: '', vehiculo_matricula: '' }); return; }
    const v = vehiculos.find(x => x.id === vehiculoId);
    set({ vehiculo_id: vehiculoId, vehiculo_matricula: v?.matricula || '' });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Car className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Vehículo / Desplazamiento <span className="text-muted-foreground font-normal">(opcional)</span></h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Vehículo</Label>
          <Select value={value.vehiculo_id || '__none__'} onValueChange={handleVehiculo}>
            <SelectTrigger><SelectValue placeholder="Sin vehículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sin vehículo —</SelectItem>
              {vehiculos.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.matricula} · {v.modelo || ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo desplazamiento</Label>
          <Select value={value.desplazamiento_tipo || '__none__'} onValueChange={v => set({ desplazamiento_tipo: v === '__none__' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Ninguno —</SelectItem>
              {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Valor desplazamiento (km)</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            placeholder="0"
            value={value.desplazamiento_valor ?? ''}
            onChange={e => set({ desplazamiento_valor: e.target.value === '' ? '' : Number(e.target.value) })}
          />
        </div>
      </div>
    </Card>
  );
}