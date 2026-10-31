import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';
import { eur } from '@/lib/nominaFormato';

const CONCEPTOS = [
  { key: 'salario_base', label: 'Salario base' },
  { key: 'prorrata_extras', label: 'Prorrata pagas extra' },
  { key: 'plus_convenio', label: 'Plus convenio' },
  { key: 'incentivos', label: 'Incentivos' },
  { key: 'horas_extra', label: 'Horas extra' },
  { key: 'bonus', label: 'Bonus / paga extra' },
  { key: 'otros_devengos', label: 'Otros devengos' },
];

const LIMITES = { con_pernocta: 53.34, sin_pernocta: 26.67 };

export default function ConceptosNominaForm({ devengos, onChange }) {
  const campo = (clave) => (e) =>
    onChange(clave, e.target.value === '' ? 0 : Number(e.target.value));

  const limiteDia = devengos.dietas_con_pernocta ? LIMITES.con_pernocta : LIMITES.sin_pernocta;
  const exentas = Math.min(
    Number(devengos.dietas_importe) || 0,
    (Number(devengos.dietas_dias) || 0) * limiteDia
  );
  const gravadas = Math.max(0, (Number(devengos.dietas_importe) || 0) - exentas);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Devengos
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CONCEPTOS.map((c) => (
            <div key={c.key}>
              <Label className="text-xs">{c.label} (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={devengos[c.key]}
                onChange={campo(c.key)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border border-border rounded-xl p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Dietas (€)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={devengos.dietas_importe}
              onChange={campo('dietas_importe')}
            />
          </div>
          <div>
            <Label className="text-xs">Días de dieta</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={devengos.dietas_dias}
              onChange={campo('dietas_dias')}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={devengos.dietas_con_pernocta}
            onCheckedChange={(v) => onChange('dietas_con_pernocta', v)}
          />
          Con pernocta (exento {LIMITES.con_pernocta.toFixed(2)} €/día; sin pernocta{' '}
          {LIMITES.sin_pernocta.toFixed(2)} €/día)
        </label>
        <p className="text-[11px] text-muted-foreground">
          Exentas {eur(exentas)} · cotizan {eur(gravadas)} del total {eur(devengos.dietas_importe)}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Deducciones propias
        </p>
        <div className="max-w-[220px]">
          <Label className="text-xs">Anticipos y otras deducciones (€)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={devengos.anticipos}
            onChange={campo('anticipos')}
          />
        </div>
      </div>

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        La base de cotización, las cuotas de Seguridad Social, la retención de IRPF y el coste de
        empresa se calculan automáticamente: no son editables.
      </p>
    </div>
  );
}