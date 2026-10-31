import { eur, sgn } from '@/lib/nominaFormato';

const ESTILO = {
  devengo: '',
  deduccion: '',
  info: 'text-xs text-muted-foreground italic',
  total: 'bg-muted/50 font-semibold',
  neto: 'bg-primary/5 font-semibold',
  empresa: 'text-muted-foreground',
  'empresa-total': 'bg-muted/50 font-semibold border-t-2 border-border',
};

export default function TablaNominaSimulada({ filas, origen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left py-2 pr-2 font-medium">Concepto</th>
            <th className="text-right py-2 px-2 font-medium">{origen ? `Real (${origen})` : 'Real'}</th>
            <th className="text-right py-2 px-2 font-medium">Simulado</th>
            <th className="text-right py-2 pl-2 font-medium">Variación</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${f.concepto}-${i}`} className={ESTILO[f.tipo] ?? ''}>
              <td className="py-2 pr-2">{f.concepto}</td>
              <td className="py-2 px-2 text-right tabular-nums">{eur(f.real)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{eur(f.simulado)}</td>
              <td
                className={`py-2 pl-2 text-right tabular-nums ${
                  f.variacion > 0
                    ? 'text-emerald-600'
                    : f.variacion < 0
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                }`}
              >
                {f.tipo === 'info' ? '—' : sgn(f.variacion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}