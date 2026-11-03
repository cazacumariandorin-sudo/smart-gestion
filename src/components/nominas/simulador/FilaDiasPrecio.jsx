import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { eur } from '@/lib/nominaFormato';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const campo =
  'h-8 min-h-0 border-0 bg-transparent px-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-0';

/**
 * RETA: el salario base se muestra siempre como días × precio/día.
 * El precio/día se guarda sin redondear para que, sin cambios, el salario base
 * sea exactamente el de la nómina real.
 */
export default function FilaDiasPrecio({ entradas, seed, onChange }) {
  const dias = Number(entradas.dias) || 0;
  const precio = Number(entradas.precio_dia) || 0;
  const salario = Number(entradas.salario_base) || 0;

  const precioVisible = r2(precio);
  const desvio = r2(Math.abs(r2(dias * precioVisible) - salario));
  const redondeo = desvio > 0 && desvio <= 0.1;
  const cambio = Math.abs(salario - (Number(seed.salario_base) || 0)) > 0.005;

  return (
    <div
      className={`col-span-2 rounded-lg border px-2 py-1.5 md:col-span-3 ${
        cambio ? 'border-amber-300 bg-amber-50/70' : 'border-border bg-card'
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1.2fr] items-end gap-1">
        <div>
          <Label className="text-[11px] text-muted-foreground">Días</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={entradas.dias}
            onChange={(e) => onChange('dias', e.target.value === '' ? 0 : Number(e.target.value))}
            className={campo}
          />
        </div>
        <span className="pb-1.5 text-xs text-muted-foreground">×</span>
        <div>
          <Label className="text-[11px] text-muted-foreground">Precio/día</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={Number.isFinite(precioVisible) ? precioVisible : 0}
            onChange={(e) => onChange('precio_dia', e.target.value === '' ? 0 : Number(e.target.value))}
            className={campo}
          />
        </div>
        <span className="pb-1.5 text-xs text-muted-foreground">=</span>
        <div>
          <Label className="text-[11px] text-muted-foreground">Salario base</Label>
          <p className="h-8 text-right text-sm font-semibold tabular-nums leading-8">{eur(salario)}</p>
        </div>
      </div>

      <p className="text-[10px] leading-tight text-muted-foreground">
        {dias} días × {precioVisible.toFixed(2)} €/día = {eur(salario)}
        {cambio && <span className="ml-1 font-semibold text-amber-700">modificado</span>}
      </p>
      {redondeo && (
        <p className="text-[10px] leading-tight text-muted-foreground">
          Diferencia de redondeo del precio/día ({eur(desvio)}).
        </p>
      )}
    </div>
  );
}