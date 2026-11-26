import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import SinDatos from './SinDatos';
import { fechaCorta } from '@/lib/fechaCorta';
import {
  buscarPartidaPresupuesto,
  CONTRASTE_PRESUPUESTO_LABEL,
  CONTRASTE_PRESUPUESTO_STYLE,
} from '@/lib/contrastePresupuesto';

const ESTADO_STYLE = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  solicitado: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
  recibido: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const ESTADO_LABEL = { pendiente: 'Pendiente', solicitado: 'Solicitado', recibido: 'Recibido' };

export default function ImplementacionMateriales({ materiales, presupuestos }) {
  const filas = useMemo(
    () => materiales.map((m) => ({ ...m, contraste: buscarPartidaPresupuesto(m.descripcion, presupuestos) })),
    [materiales, presupuestos]
  );

  const resumen = useMemo(() => {
    const r = { coincide: 0, dudoso: 0, sin_partida: 0, sin_presupuesto: 0, sin_datos: 0 };
    filas.forEach((f) => { r[f.contraste.estado] = (r[f.contraste.estado] || 0) + 1; });
    return r;
  }, [filas]);

  if (!materiales.length) {
    return (
      <SinDatos
        mensaje="Sin material pendiente registrado"
        detalle="No hay solicitudes de material vinculadas a esta obra. Un material citado en un informe no aparece aquí hasta que se registra en Obras → Material pendiente."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['coincide', 'dudoso', 'sin_partida', 'sin_presupuesto'].map((k) => (
          <span key={k} className={`text-xs px-2 py-1 rounded border ${CONTRASTE_PRESUPUESTO_STYLE[k]}`}>
            {CONTRASTE_PRESUPUESTO_LABEL[k]}: {resumen[k] || 0}
          </span>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {filas.map((m) => (
          <div key={m.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-words">{m.descripcion}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${ESTADO_STYLE[m.estado] || ''}`}>
                    {ESTADO_LABEL[m.estado] || m.estado}
                  </span>
                  {m.prioridad && m.prioridad !== 'media' && (
                    <span className="text-xs text-muted-foreground">Prioridad {m.prioridad}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{fechaCorta(m.fecha_solicitud)}</span>
                  {m.solicitado_por_nombre && <span className="text-xs text-muted-foreground">· {m.solicitado_por_nombre}</span>}
                </div>
                {m.notas_admin && <p className="text-xs text-muted-foreground mt-1">{m.notas_admin}</p>}
              </div>
              <div className="shrink-0 text-right max-w-[45%]">
                <span className={`text-xs px-2 py-0.5 rounded border ${CONTRASTE_PRESUPUESTO_STYLE[m.contraste.estado]}`}>
                  {CONTRASTE_PRESUPUESTO_LABEL[m.contraste.estado]}
                </span>
                {m.contraste.detalle && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{m.contraste.detalle}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          El contraste con el presupuesto es orientativo y por similitud de texto: «Coincide» señala una línea parecida,
          no confirma que el material esté incluido ni certificado.
        </p>
      </div>
    </div>
  );
}