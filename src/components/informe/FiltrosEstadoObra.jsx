/**
 * Filtros desplegables por estado de obra (En curso / Planificadas / Completadas)
 * Especificación manual v2.0 — sección 2.5 y 4.6
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const COLORES_OBRA = [
  '#378ADD', '#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#E05A9A',
  '#4A9ECC', '#5EAA6A', '#CC6B35', '#9975BB',
];

function getObraColor(idx) {
  return COLORES_OBRA[idx % COLORES_OBRA.length];
}

function BarraProgreso({ progreso, color }) {
  if (!progreso || progreso <= 0) return null;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, progreso)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function FiltrosEstadoObra({ obras }) {
  const [openEnCurso, setOpenEnCurso] = useState(false);
  const [openPlanificadas, setOpenPlanificadas] = useState(false);

  const enCurso = obras.filter(o => o.status === 'activa');
  const planificadas = obras.filter(o => o.status === 'presupuesto');
  const completadas = obras.filter(o => o.status === 'finalizada' || o.status === 'pausada');

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-wrap gap-2">
        {/* En curso */}
        <button
          onClick={() => setOpenEnCurso(v => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-[#1D9E75] inline-block" />
          En curso ({enCurso.length})
          {openEnCurso ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        {/* Planificadas */}
        <button
          onClick={() => setOpenPlanificadas(v => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-[#378ADD] inline-block" />
          Planificadas ({planificadas.length})
          {openPlanificadas ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        {/* Completadas — estático */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-[#888780] inline-block" />
          Completadas ({completadas.length})
        </div>
      </div>

      {/* Desplegable En curso */}
      {openEnCurso && enCurso.length > 0 && (
        <div className="border border-[#1D9E75]/30 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-[#1D9E75]/10 text-xs font-semibold text-[#1D9E75]">Obras en ejecución</div>
          <div className="divide-y divide-border">
            {enCurso.map((o, i) => {
              const color = getObraColor(i);
              const progreso = o.porcentaje_avance_horas || 0;
              return (
                <div key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 bg-card hover:bg-muted/20">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{o.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {o.contact_person && <span>{o.contact_person} · </span>}
                      {progreso > 0 && <span className="text-primary font-medium">{progreso}% avance</span>}
                    </p>
                    <BarraProgreso progreso={progreso} color={color} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {openEnCurso && enCurso.length === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border border-dashed rounded-xl">Sin obras en curso.</div>
      )}

      {/* Desplegable Planificadas */}
      {openPlanificadas && planificadas.length > 0 && (
        <div className="border border-[#378ADD]/30 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-[#378ADD]/10 text-xs font-semibold text-[#378ADD]">Obras planificadas</div>
          <div className="divide-y divide-border">
            {planificadas.map((o, i) => (
              <div key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 bg-card hover:bg-muted/20">
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: getObraColor(i + enCurso.length) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{o.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {o.contact_person && <span>{o.contact_person} · </span>}
                    {o.start_date && <span>Inicio: {o.start_date} · </span>}
                    {o.budget && <span>{Number(o.budget).toLocaleString('es-ES')} €</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {openPlanificadas && planificadas.length === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border border-dashed rounded-xl">Sin obras planificadas.</div>
      )}
    </div>
  );
}