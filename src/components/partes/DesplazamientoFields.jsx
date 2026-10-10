/**
 * DesplazamientoFields — Bloque OPCIONAL para registrar el vehículo y el
 * desplazamiento realizado en un parte de trabajo o parte diario.
 * No bloquea el guardado: si está vacío, el parte se crea igual.
 *
 * Props:
 *   value: { vehiculo_id, vehiculo_matricula, desplazamiento_tipo, desplazamiento_valor, desplazamiento_importe_eur,
 *            desplazamiento_modalidad, desplazamiento_concepto }
 *   onChange: (partial) => void
 *   allowPactado: habilita la modalidad "Importe pactado con el cliente" (sin km). Solo partes de trabajo.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Euro } from 'lucide-react';

const TIPOS = [
  { value: 'desplazamiento', label: 'Desplazamiento a obra' },
  { value: 'traslado', label: 'Traslado entre obras' },
  { value: 'compras', label: 'Compra de materiales' },
  { value: 'otro', label: 'Otro' },
];

// Tarifa de la empresa por km desplazado (€). Edítala si la política cambia.
export const KM_RATE_EUR = 0.30;

export default function DesplazamientoFields({ value = {}, onChange, allowPactado = false }) {
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

  const handleKm = (raw) => {
    const km = raw === '' ? '' : Number(raw);
    const importe = (km === '' || isNaN(km) || km <= 0) ? '' : Math.round(km * KM_RATE_EUR * 100) / 100;
    set({ desplazamiento_valor: km, desplazamiento_importe_eur: importe });
  };

  const pactado = allowPactado && value.desplazamiento_modalidad === 'pactado';

  const handleModalidad = (m) => {
    if (m === 'pactado') set({ desplazamiento_modalidad: 'pactado', desplazamiento_valor: '', desplazamiento_importe_eur: '' });
    else set({ desplazamiento_modalidad: 'km', desplazamiento_concepto: '', desplazamiento_importe_eur: '' });
  };

  const handleImportePactado = (raw) => {
    set({ desplazamiento_importe_eur: raw === '' ? '' : Number(raw) });
  };

  const importeEur = value.desplazamiento_importe_eur;
  const mostrarImporte = importeEur !== '' && importeEur !== undefined && importeEur !== null && !isNaN(importeEur);

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
        {!pactado && (
        <div className="space-y-1.5">
          <Label className="text-xs">Valor desplazamiento (km) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={value.desplazamiento_valor ?? ''}
            onChange={e => handleKm(e.target.value)}
          />
          {mostrarImporte && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-md px-2 py-1.5">
              <Euro className="w-3.5 h-3.5" />
              <span>{Number(importeEur).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
              <span className="text-muted-foreground font-normal">· {KM_RATE_EUR.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/km</span>
            </div>
          )}
        </div>
        )}
      </div>

      {allowPactado && value.desplazamiento_tipo && (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Cálculo del desplazamiento</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModalidad('km')}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${!pactado ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
              >
                Por kilómetros
              </button>
              <button
                type="button"
                onClick={() => handleModalidad('pactado')}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${pactado ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
              >
                Importe pactado con cliente
              </button>
            </div>
          </div>

          {pactado && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Importe aprobado por el cliente (€) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={value.desplazamiento_importe_eur ?? ''}
                  onChange={e => handleImportePactado(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Concepto / ref. presupuesto *</Label>
                <Input
                  placeholder="Ej.: Portugal – presupuesto 2026-014"
                  value={value.desplazamiento_concepto || ''}
                  onChange={e => set({ desplazamiento_concepto: e.target.value })}
                />
              </div>
              <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                No hace falta indicar kilómetros: se factura el importe pactado.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}