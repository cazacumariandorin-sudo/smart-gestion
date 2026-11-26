import React from 'react';
import { Info, CalendarRange } from 'lucide-react';
import SinDatos from './SinDatos';
import { fechaCorta, horas } from '@/lib/fechaCorta';

const SEMAFORO = {
  verde: 'bg-emerald-500',
  amarillo: 'bg-amber-500',
  rojo: 'bg-rose-500',
  sin_datos: 'bg-slate-300',
};

const STATUS_LABEL = {
  planificada: 'Planificada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function ImplementacionAvance({ partes, previsiones, fichajes }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          La app no guarda un porcentaje de avance físico por zona y actividad. Aquí se muestra la actividad registrada
          (previsión, partes diarios y horas). El avance de un informe solo existe si se carga como documento.
        </p>
      </div>

      <section className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-teal-600" /> Previsión y horas
        </h3>
        {previsiones.length === 0 ? (
          <SinDatos mensaje="Sin previsión de obra" detalle="No hay registros de previsión vinculados a esta obra." />
        ) : (
          <div className="divide-y divide-border">
            {previsiones.map((p) => (
              <div key={p.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${SEMAFORO[p.status_semaforo] || SEMAFORO.sin_datos}`} />
                  <span className="text-sm font-medium">{STATUS_LABEL[p.status] || p.status}</span>
                  <span className="text-xs text-muted-foreground">{fechaCorta(p.fecha_inicio)} → {fechaCorta(p.fecha_fin) || 'sin fin'}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {horas(p.horas_reales_acumuladas)} de {horas(p.horas_totales_previstas)} previstas
                  </span>
                </div>
                {p.operarios_asignados?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.operarios_asignados.map((o) => o.operario_name).filter(Boolean).join(', ')}
                  </p>
                )}
                {p.notas && <p className="text-xs mt-1">{p.notas}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border">Actividad por jornada (partes diarios)</h3>
        {partes.length === 0 ? (
          <SinDatos mensaje="Sin partes diarios" detalle="No hay partes vinculados a esta obra. Los trabajos realizados no se pueden mostrar." />
        ) : (
          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {partes.map((p) => (
              <article key={p.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium">{fechaCorta(p.fecha)}</span>
                  <span className="text-xs text-muted-foreground">{p.tecnico_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${p.estado === 'cerrado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {p.estado === 'cerrado' ? 'Cerrado' : 'Borrador'}
                  </span>
                  {p.tecnicos_adicionales?.length > 0 && (
                    <span className="text-xs text-muted-foreground">+{p.tecnicos_adicionales.length} técnicos</span>
                  )}
                </div>
                {p.trabajos_realizados && <p className="text-sm whitespace-pre-line line-clamp-4">{p.trabajos_realizados}</p>}
                {p.trabajos_pendientes && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1"><strong>Pendiente:</strong> {p.trabajos_pendientes}</p>
                )}
                {p.materiales_necesarios && (
                  <p className="text-xs text-muted-foreground mt-1"><strong>Material:</strong> {p.materiales_necesarios}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground px-1">
        {fichajes.length} fichajes vinculados a la obra se usan solo como contexto de actividad, no como medida del avance físico.
      </p>
    </div>
  );
}