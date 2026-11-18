import { Badge } from '@/components/ui/badge';

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/**
 * Informe técnico interno: alcance, mediciones, materiales agrupados y
 * desglose de costes. Solo para dirección; nunca va al cliente.
 */
export default function InformeTecnicoResumen({ informe }) {
  if (!informe) return null;
  const d = informe.desglose || {};
  const t = informe.totales || {};

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alcance</h3>
        <p className="text-sm leading-relaxed">{informe.alcance || 'Sin alcance determinado.'}</p>
        {informe.datos_no_disponibles?.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Datos no disponibles en la documentación</p>
            {informe.datos_no_disponibles.map((x, i) => <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300">· {x}</p>)}
          </div>
        )}
      </section>

      {informe.mediciones?.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mediciones y cálculos detectados</h3>
          {informe.mediciones.map((m, i) => <p key={i} className="text-xs">· {m}</p>)}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Materiales agrupados</h3>
        {informe.materiales_agrupados?.length > 0 ? (
          <div className="space-y-2">
            {informe.materiales_agrupados.map((g, gi) => (
              <div key={gi} className="rounded-lg border border-border p-2">
                <p className="text-xs font-semibold mb-1">{g.grupo || 'Sin grupo'}</p>
                <div className="space-y-0.5">
                  {(g.items || []).map((it, ii) => (
                    <div key={ii} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">{it.descripcion}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{it.cantidad} {it.unidad}</span>
                      <span className="font-medium whitespace-nowrap">{eur(it.coste_estimado)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">No se han identificado materiales en la documentación.</p>}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Desglose interno</h3>
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
          {[
            ['Materiales', d.materiales],
            ['Mano de obra', d.mano_obra],
            ['Dietas', d.dietas],
            ['Desplazamiento', d.desplazamiento],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between"><span>{label}</span><span className="font-medium">{eur(value)}</span></div>
          ))}
          <div className="flex justify-between border-t pt-1 font-bold"><span>Coste interno total</span><span>{eur(d.coste_total)}</span></div>
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Precio propuesto (margen {t.margen_pct ?? 0}%)</span><span className="font-bold">{eur(t.precio_propuesto)}</span></div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="text-[10px]">{informe.horas_totales || 0} h estimadas</Badge>
          <Badge variant="outline" className="text-[10px]">{eur(informe.coste_hora_interno)}/h</Badge>
          {informe.fuente_coste_hora === 'tarifa_cliente' && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Mano de obra valorada con tarifa de cliente</Badge>
          )}
          {informe.confianza > 0 && <Badge variant="outline" className="text-[10px]">Confianza {Math.round(informe.confianza * 100)}%</Badge>}
        </div>
      </section>

      {informe.supuestos?.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Supuestos aplicados</h3>
          {informe.supuestos.map((s, i) => <p key={i} className="text-[11px] text-muted-foreground">· {s}</p>)}
        </section>
      )}
    </div>
  );
}