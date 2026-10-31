import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { eur } from '@/lib/nominaFormato';

const LIMITES = { con_pernocta: 53.34, sin_pernocta: 26.67 };

export default function EscenarioTrabajadorCard({ linea, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const esReta = linea.regimen === 'autonomo_societario';
  const real = linea.real || {};

  const campo = (clave) => (e) =>
    onChange({ [clave]: e.target.value === '' ? 0 : Number(e.target.value) });

  const limiteDia = linea.dietas_con_pernocta ? LIMITES.con_pernocta : LIMITES.sin_pernocta;
  const exentas = Math.min(Number(linea.dietas_importe) || 0, (Number(linea.dietas_dias) || 0) * limiteDia);

  return (
    <div
      className={`border rounded-xl transition-colors ${
        linea.incluido ? 'border-border bg-card' : 'border-border/60 bg-muted/30 opacity-70'
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        <Switch
          checked={linea.incluido}
          onCheckedChange={(v) => onChange({ incluido: v })}
          aria-label={`Incluir a ${linea.operario_name}`}
        />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium truncate">{linea.operario_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {real.periodo || 'sin nómina previa'} · bruto {eur(real.bruto)} · coste {eur(real.coste)}
          </p>
        </button>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </div>

      {abierto && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Salario base (€)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={linea.salario_base} onChange={campo('salario_base')} />
            </div>
            <div>
              <Label className="text-xs">Prorrata extras (€)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={linea.prorrata_extras} onChange={campo('prorrata_extras')} />
            </div>
            <div>
              <Label className="text-xs">Incentivo (€)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={linea.incentivo} onChange={campo('incentivo')} />
            </div>
            <div>
              <Label className="text-xs">Paga extra / bonus (€)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={linea.bonus} onChange={campo('bonus')} />
            </div>
            <div>
              <Label className="text-xs">Dietas (€)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={linea.dietas_importe} onChange={campo('dietas_importe')} />
            </div>
            <div>
              <Label className="text-xs">Días de dieta</Label>
              <Input type="number" inputMode="numeric" value={linea.dietas_dias} onChange={campo('dietas_dias')} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={linea.dietas_con_pernocta}
              onCheckedChange={(v) => onChange({ dietas_con_pernocta: v })}
            />
            Dietas con pernocta (exento {LIMITES.con_pernocta.toFixed(2)} €/día)
          </label>
          <p className="text-[11px] text-muted-foreground">
            Exentas {eur(exentas)} de {eur(linea.dietas_importe)}: no cotizan ni tributan.
          </p>

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <Label className="text-xs">Régimen</Label>
              <MobileSelect
                value={linea.regimen}
                onValueChange={(v) => onChange({ regimen: v })}
                placeholder="Régimen"
              >
                <MobileSelectItem value="general">Régimen general</MobileSelectItem>
                <MobileSelectItem value="autonomo_societario">Autónomo societario</MobileSelectItem>
              </MobileSelect>
            </div>
            {esReta && (
              <div>
                <Label className="text-xs">Cuota RETA (€)</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={linea.cuota_reta} onChange={campo('cuota_reta')} />
              </div>
            )}
          </div>

          {esReta && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={linea.empresa_asume_reta}
                onCheckedChange={(v) => onChange({ empresa_asume_reta: v })}
              />
              La empresa asume la cuota RETA (coste añadido, sin cotización general)
            </label>
          )}
        </div>
      )}
    </div>
  );
}