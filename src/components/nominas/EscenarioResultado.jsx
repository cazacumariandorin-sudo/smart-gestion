import { Info } from 'lucide-react';
import { eur, sgn } from '@/lib/nominaFormato';

const colorDelta = (n, invertir = false) => {
  const v = Number(n) || 0;
  if (v === 0) return 'text-muted-foreground';
  const sube = invertir ? v < 0 : v > 0;
  return sube ? 'text-destructive' : 'text-emerald-600';
};

function Kpi({ label, valor, delta, nota }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
      {delta !== undefined && (
        <p className={`text-xs ${colorDelta(delta)}`}>{sgn(delta)} vs actual</p>
      )}
      {nota && <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>}
    </div>
  );
}

export default function EscenarioResultado({ resultado }) {
  const { periodo, totales, lineas, supuestos, avisos, aviso } = resultado;
  const d = totales.variacion;

  return (
    <div className="border-t border-border pt-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Escenario de {periodo}</h3>
        <p className="text-xs text-muted-foreground">
          {totales.trabajadores} trabajadores · comparado con su última nómina real
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Coste empresa · mes" valor={eur(totales.coste)} delta={d.coste} />
        <Kpi label="Coste empresa · año" valor={eur(totales.coste_anual)} delta={totales.variacion_anual} nota="12 meses al mismo ritmo" />
        <Kpi label="Líquido a percibir" valor={eur(totales.neto)} delta={d.neto} />
        <Kpi label="Seguridad Social empresa" valor={eur(totales.ss_empresa)} />
        <Kpi label="Bases de cotización" valor={eur(totales.base_cotizacion)} delta={d.base_cotizacion} />
        <Kpi
          label="Dietas exentas"
          valor={eur(totales.dietas_exentas)}
          nota="Coste sin cotizar ni tributar"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Detalle por trabajador</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-2 py-2">Trabajador</th>
                <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Coste actual</th>
                <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Coste escenario</th>
                <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Δ coste</th>
                <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Δ líquido</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.operario_id || l.operario_name} className="border-t border-border/60">
                  <td className="px-2 py-2">
                    <span className="block truncate max-w-[9rem]">{l.operario_name}</span>
                    {l.calculo.tope_aplicado && (
                      <span className="text-[10px] text-amber-600">base topada</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{eur(l.real.coste)}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap font-medium">{eur(l.calculo.coste)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${colorDelta(l.variacion.coste)}`}>
                    {sgn(l.variacion.coste)}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${colorDelta(l.variacion.neto, true)}`}>
                    {sgn(l.variacion.neto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {avisos?.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800">Avisos del cálculo</p>
          {avisos.map((a, i) => (
            <p key={i} className="text-xs text-amber-800">· {a}</p>
          ))}
        </section>
      )}

      <section className="rounded-xl bg-muted/40 p-3 space-y-1">
        <p className="text-xs font-semibold flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> Supuestos del cálculo
        </p>
        {supuestos.map((s, i) => (
          <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">· {s}</p>
        ))}
        <p className="text-[11px] text-muted-foreground pt-1 italic">{aviso}</p>
      </section>
    </div>
  );
}