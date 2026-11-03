import { eur, sgn } from '@/lib/nominaFormato';

const ESTILO = {
  concepto: '',
  base: 'bg-muted/40 font-medium',
  deduccion: '',
  total: 'border-t border-border bg-muted/50 font-semibold',
  liquido: 'border-t border-border bg-primary/10 font-semibold',
  empresa: 'text-muted-foreground',
  coste: 'border-t-2 border-border bg-muted font-semibold',
};

const colorDiferencia = (fila) => {
  if (!fila.diferencia) return 'text-muted-foreground';
  const esCoste = fila.key === 'coste' || fila.key === 'ss_empresa';
  const bueno = esCoste ? fila.diferencia < 0 : fila.diferencia > 0;
  return bueno ? 'text-emerald-600' : 'text-red-600';
};

/** Tabla comparativa Actual (histórico) / Simulado / Diferencia, concepto a concepto. */
export default function TablaComparativa({ filas, actualLabel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">Concepto</th>
            <th className="px-2 py-2 text-right font-medium">{actualLabel || 'Actual'}</th>
            <th className="px-2 py-2 text-right font-medium">Simulado</th>
            <th className="py-2 pl-2 text-right font-medium">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.key} className={ESTILO[f.tipo] || ''}>
              <td className="py-1.5 pr-2">{f.concepto}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{eur(f.actual)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{eur(f.simulado)}</td>
              <td className={`py-1.5 pl-2 text-right tabular-nums ${colorDiferencia(f)}`}>
                {f.diferencia ? sgn(f.diferencia) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}