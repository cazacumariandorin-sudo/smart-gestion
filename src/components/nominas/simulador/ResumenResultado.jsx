import { RotateCcw, Info, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eur, sgn, pct } from '@/lib/nominaFormato';

const Kpi = ({ etiqueta, valor, detalle, tono = 'neutro' }) => {
  const tonos = {
    neutro: 'border-border bg-card',
    bueno: 'border-emerald-200 bg-emerald-50/60',
    malo: 'border-red-200 bg-red-50/60',
    principal: 'border-primary/30 bg-primary/5',
  };
  return (
    <div className={`rounded-xl border p-3 ${tonos[tono]}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
    </div>
  );
};

/** Resumen del resultado: líquido simulado, desviaciones, avisos y restablecer. */
export default function ResumenResultado({ resultado, onRestablecer, deshabilitado }) {
  const { totales, avisos, variantes, tipo_irpf, origen_irpf } = resultado;
  const dLiq = totales.liquido.diferencia;
  const dCoste = totales.coste.diferencia;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Kpi
          etiqueta="Líquido simulado"
          valor={eur(totales.liquido.simulado)}
          detalle={`Histórico: ${eur(totales.liquido.actual)}`}
          tono="principal"
        />
        <Kpi
          etiqueta="Diferencia de líquido"
          valor={dLiq ? sgn(dLiq) : 'Sin cambios'}
          detalle={dLiq > 0 ? 'Cobra más' : dLiq < 0 ? 'Cobra menos' : 'Igual que la nómina real'}
          tono={dLiq > 0 ? 'bueno' : dLiq < 0 ? 'malo' : 'neutro'}
        />
        <Kpi
          etiqueta="Diferencia de coste empresa"
          valor={dCoste ? sgn(dCoste) : 'Sin cambios'}
          detalle={`Coste simulado: ${eur(totales.coste.simulado)}`}
          tono={dCoste > 0 ? 'malo' : dCoste < 0 ? 'bueno' : 'neutro'}
        />
      </div>

      {variantes && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold">
            <TrendingUp className="h-3.5 w-3.5" /> Aumento de {eur(variantes.incremento)} en el salario base
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-card p-2">
              <p className="font-medium">Absorber del complemento</p>
              <p className="text-muted-foreground">Complemento: {eur(variantes.absorbe.complemento)}</p>
              <p className="tabular-nums">Líquido {eur(variantes.absorbe.liquido)}</p>
              <p className="tabular-nums text-muted-foreground">Coste {eur(variantes.absorbe.coste)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2">
              <p className="font-medium">Sumar al salario</p>
              <p className="text-muted-foreground">Complemento: {eur(variantes.suma.complemento)}</p>
              <p className="tabular-nums">Líquido {eur(variantes.suma.liquido)}</p>
              <p className="tabular-nums text-muted-foreground">Coste {eur(variantes.suma.coste)}</p>
            </div>
          </div>
          {variantes.disponible === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No hay complemento absorbible en la precarga: el aumento se suma íntegro al salario.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {avisos.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] ${
              a.nivel === 'aviso'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}
          >
            {a.nivel === 'aviso' ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-[11px] text-muted-foreground">
        <span>
          Retención constante: {pct(tipo_irpf)} tomada de {origen_irpf}. No se recalcula el IRPF.
        </span>
        {onRestablecer && (
          <Button variant="outline" size="sm" onClick={onRestablecer} disabled={deshabilitado} className="h-7 gap-1 px-2 text-[11px]">
            <RotateCcw className="h-3.5 w-3.5" /> Restablecer a histórico
          </Button>
        )}
      </div>
    </div>
  );
}