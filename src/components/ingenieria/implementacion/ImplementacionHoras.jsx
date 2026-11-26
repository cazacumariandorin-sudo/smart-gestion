import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import SinDatos from './SinDatos';
import KpiCard from './KpiCard';
import { fechaCorta, horas } from '@/lib/fechaCorta';

const ORIGEN_LABEL = {
  trabajador: 'Trabajador',
  gerencia: 'Gerencia',
  cierre_forzado_gerencia: 'Cierre forzado',
  cierre_automatico: 'Cierre automático',
  administracion: 'Administración',
  importacion: 'Importación',
};

export default function ImplementacionHoras({ fichajes, previsiones }) {
  const totalHoras = fichajes.reduce((s, f) => s + (Number(f.horas_trabajadas) || 0), 0);
  const horasPrevistas = previsiones.reduce((s, p) => s + (Number(p.horas_totales_previstas) || 0), 0);

  const porOperario = useMemo(() => {
    const mapa = new Map();
    fichajes.forEach((f) => {
      const nombre = f.operario_name || 'Sin operario';
      mapa.set(nombre, (mapa.get(nombre) || 0) + (Number(f.horas_trabajadas) || 0));
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [fichajes]);

  if (!fichajes.length) {
    return (
      <SinDatos
        mensaje="Sin fichajes vinculados"
        detalle="No hay apuntes de jornada asociados a esta obra. Las horas no se pueden calcular sin registros."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={Clock} label="Horas registradas" value={horas(totalHoras)} hint={`${fichajes.length} fichajes`} />
        <KpiCard label="Horas previstas" value={horasPrevistas || '—'} hint={horasPrevistas ? 'Según previsión de obra' : 'Sin previsión cargada'} tone={horasPrevistas ? 'default' : 'vacio'} />
        <KpiCard label="Personas" value={porOperario.length} hint="Con al menos un fichaje" />
      </div>

      <div className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border">Horas por persona</h3>
        <div className="divide-y divide-border">
          {porOperario.map(([nombre, total]) => (
            <div key={nombre} className="p-3 flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{nombre}</span>
              <span className="font-medium shrink-0">{horas(total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border">Últimos fichajes</h3>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {fichajes.slice(0, 60).map((f) => (
            <div key={f.id} className="p-3 flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-20 shrink-0">{fechaCorta(f.date)}</span>
              <span className="flex-1 truncate">{f.operario_name}</span>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {f.hora_entrada || '—'}–{f.hora_salida || '—'}
              </span>
              <span className="font-medium shrink-0">{horas(f.horas_trabajadas)}</span>
              {f.origen && f.origen !== 'trabajador' && (
                <span className="text-[11px] px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                  {ORIGEN_LABEL[f.origen] || f.origen}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Las horas son actividad operativa: no equivalen al porcentaje de ejecución de la obra.
      </p>
    </div>
  );
}