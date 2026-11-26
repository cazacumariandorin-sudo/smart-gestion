import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import SinDatos from './SinDatos';
import { SEVERIDAD_STYLE, DISCREPANCIA_TIPO_LABEL, ESTADO_DISCREP_STYLE } from '@/lib/ingenieriaUtils';

export default function ImplementacionDiscrepancias({ discrepancias, obra }) {
  const abiertas = discrepancias.filter((d) => d.estado === 'abierta');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {discrepancias.length} discrepancia(s) · {abiertas.length} abierta(s)
        </p>
        <Link to={`/ingenieria/discrepancias?obra_id=${obra.id}`} className="text-xs text-primary inline-flex items-center">
          Gestionar en el panel completo <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {discrepancias.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <SinDatos
            mensaje="Sin discrepancias registradas"
            detalle="Todavía no se ha conciliado este proyecto. Al conciliarlo se comparan documentos, partidas y pedidos."
          />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {discrepancias.map((d) => (
            <div key={d.id} className="p-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${SEVERIDAD_STYLE[d.severidad] || ''}`}>{d.severidad}</span>
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                    {DISCREPANCIA_TIPO_LABEL[d.tipo] || (d.tipo || '').replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${ESTADO_DISCREP_STYLE[d.estado] || ''}`}>{d.estado}</span>
                </div>
                <p className="text-sm">{d.descripcion}</p>
                {d.accion_recomendada && <p className="text-xs text-muted-foreground mt-1">Acción: {d.accion_recomendada}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}