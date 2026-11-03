import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Campo numérico del simulador: muestra siempre el valor histórico al lado y
 * marca en ámbar cuando el importe simulado difiere del real.
 */
export default function CampoSimulacion({
  label,
  value,
  original,
  onChange,
  sufijo = '€',
  step = '0.01',
  deshabilitado = false,
  ayuda,
}) {
  const cambio =
    original !== undefined && Math.abs((Number(value) || 0) - (Number(original) || 0)) > 0.005;

  return (
    <div
      className={`rounded-lg border px-2 py-1.5 ${
        cambio ? 'border-amber-300 bg-amber-50/70' : 'border-border bg-card'
      }`}
    >
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          disabled={deshabilitado}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="h-8 min-h-0 border-0 bg-transparent px-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-0"
        />
        <span className="text-[11px] text-muted-foreground">{sufijo}</span>
      </div>
      <div className="flex items-center justify-between gap-1 text-[10px] leading-tight">
        <span className="text-muted-foreground">
          {original !== undefined
            ? `histórico ${Number(original).toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}`
            : ''}
        </span>
        {cambio && <span className="font-semibold text-amber-700">modificado</span>}
      </div>
      {ayuda && <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{ayuda}</p>}
    </div>
  );
}