import { Loader2, TrendingDown, TrendingUp, AlertTriangle, Wallet, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const eur = (n) => `${(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (n) => n == null ? '—' : `${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

const ESTADO_BADGE = {
  perdida: { label: 'En pérdida', cls: 'bg-red-100 text-red-700 border-red-200' },
  sobrecoste: { label: 'Sobrecoste', cls: 'bg-red-100 text-red-700 border-red-200' },
  sin_presupuesto: { label: 'Sin presupuesto', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function MargenPorObra({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Calculando margen por obra…
      </div>
    );
  }

  const obras = data?.obras || [];
  const fijos = data?.fijos || {};

  if (!obras.length) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
        No hay actividad económica (ingresos ni costes) en este periodo para ninguna obra.
      </div>
    );
  }

  const sinPresupuesto = obras.filter(o => o.estado === 'sin_presupuesto');

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="w-4 h-4 text-primary" /> Margen por obra
          <span className="text-xs font-normal text-muted-foreground">(ordenado por margen € ascendente)</span>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[820px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 px-2">Obra</th>
                <th className="text-left font-medium py-2 px-2 hidden sm:table-cell">Cliente</th>
                <th className="text-right font-medium py-2 px-2">Ingreso</th>
                <th className="text-right font-medium py-2 px-2">Gastos</th>
                <th className="text-right font-medium py-2 px-2 hidden md:table-cell">Mat.</th>
                <th className="text-right font-medium py-2 px-2 hidden md:table-cell">Flota</th>
                <th className="text-right font-medium py-2 px-2 hidden md:table-cell">Nómina</th>
                <th className="text-right font-medium py-2 px-2">Coste</th>
                <th className="text-right font-medium py-2 px-2">Margen €</th>
                <th className="text-right font-medium py-2 px-2">Margen %</th>
                <th className="text-right font-medium py-2 px-2 hidden lg:table-cell">% Presup.</th>
                <th className="text-center font-medium py-2 px-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {obras.map(o => {
                const neg = o.margen_eur < 0;
                return (
                  <tr key={o.obra_id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium truncate max-w-[180px]">{o.obra_name}</td>
                    <td className="py-2 px-2 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">{o.cliente || '—'}</td>
                    <td className="py-2 px-2 text-right">{eur(o.ingreso)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{eur(o.gastos)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground hidden md:table-cell">{eur(o.materiales)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground hidden md:table-cell">{eur(o.flota)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground hidden md:table-cell">{eur(o.nominas_imputadas)}</td>
                    <td className="py-2 px-2 text-right font-medium">{eur(o.coste_total)}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${neg ? 'text-red-600' : 'text-emerald-600'}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {neg ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {eur(o.margen_eur)}
                      </span>
                    </td>
                    <td className={`py-2 px-2 text-right ${neg ? 'text-red-600' : 'text-emerald-600'}`}>{pct(o.margen_pct)}</td>
                    <td className="py-2 px-2 text-right hidden lg:table-cell">
                      {o.pct_sobre_presupuesto == null ? '—' : (
                        <span className={o.pct_sobre_presupuesto > 100 ? 'text-red-600' : 'text-muted-foreground'}>
                          {pct(o.pct_sobre_presupuesto)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[o.estado]?.cls || ''}`}>
                        {ESTADO_BADGE[o.estado]?.label || o.estado}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(fijos.gastos_fijos > 0 || fijos.nominas_no_imputadas > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
            <span><Wallet className="w-3 h-3 inline mr-1" />Gastos sin obra (fijos): {eur(fijos.gastos_fijos)}</span>
            <span>Nóminas no imputadas a obra: {eur(fijos.nominas_no_imputadas)}</span>
          </div>
        )}
      </div>

      {sinPresupuesto.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-semibold">Obras sin presupuesto definido ({sinPresupuesto.length}):</span>{' '}
            {sinPresupuesto.map(o => o.obra_name).join(', ')}. No se puede calcular sobrecoste ni % sobre presupuesto.
          </div>
        </div>
      )}
    </div>
  );
}