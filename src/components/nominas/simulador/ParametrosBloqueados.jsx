import { Lock } from 'lucide-react';

const TablaTipos = ({ titulo, total, filas }) => (
  <div className="rounded-lg border border-border bg-card p-2">
    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
      <span>{titulo}</span>
      <span className="tabular-nums text-primary">{total.toFixed(2)} %</span>
    </div>
    <ul className="space-y-0.5 text-[11px] text-muted-foreground">
      {filas.map((f) => (
        <li key={f.key} className="flex justify-between tabular-nums">
          <span>{f.label}</span>
          <span>{f.tipo.toFixed(2)} %</span>
        </li>
      ))}
    </ul>
  </div>
);

/** Tabla de parámetros legales: no se editan en el simulador. */
export default function ParametrosBloqueados({ parametros }) {
  if (!parametros) return null;
  const convenio = Object.entries(parametros.convenio || {});

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 p-3 text-xs font-semibold">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        Parámetros de cotización (vigencia {parametros.vigencia}) · solo lectura
      </summary>
      <div className="space-y-2 border-t border-border p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TablaTipos titulo="Aportación del trabajador" total={parametros.tipo_trabajador} filas={parametros.trabajador} />
          <TablaTipos titulo="Aportación de la empresa" total={parametros.tipo_empresa} filas={parametros.empresa} />
        </div>
        <div className="grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border border-border p-2">
            <p className="font-semibold text-foreground">Bases de cotización</p>
            <p>Mínima: {parametros.base_minima.toFixed(2)} € · Máxima: {parametros.base_maxima.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="font-semibold text-foreground">Dietas exentas</p>
            <p>
              {parametros.dietas.sin_pernocta.toFixed(2)} €/día sin pernocta ·{' '}
              {parametros.dietas.con_pernocta.toFixed(2)} €/día con pernocta
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border p-2 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">Mínimos de convenio (orientativos)</p>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
            {convenio.map(([key, c]) => (
              <span key={key} className="flex justify-between tabular-nums">
                <span>{c.label}</span>
                <span>{(c.mensual / parametros.dias_mes).toFixed(2)} €/día</span>
              </span>
            ))}
          </div>
          <p className="mt-1">
            Valores de referencia para avisar si el precio/día queda por debajo del convenio. El IRPF no se calcula.
          </p>
        </div>
      </div>
    </details>
  );
}