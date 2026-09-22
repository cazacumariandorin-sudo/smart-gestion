import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileCog, Check, X, HelpCircle } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';

const COMP_STYLE = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  incompatible: 'bg-red-100 text-red-700 border-red-300',
  revisar: 'bg-amber-100 text-amber-700 border-amber-300',
  no_aplica: 'bg-slate-100 text-slate-500 border-slate-300',
};
const COMP_ICON = { ok: Check, incompatible: X, revisar: HelpCircle, no_aplica: HelpCircle };
const ESTADO_STYLE = {
  pendiente_revision: 'bg-amber-50 text-amber-700',
  confirmado: 'bg-emerald-50 text-emerald-700',
  descartado: 'bg-red-50 text-red-700',
};

export default function IngenieriaFichas() {
  const qc = useQueryClient();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const effective = obraId || obras[0]?.id;
  const [actualizando, setActualizando] = useState(null);

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ['ing-fichas', effective],
    queryFn: async () => effective ? base44.entities.FichaTecnicaEquipo.filter({ obra_id: effective }, '-created_date', 200) : [],
    enabled: !!effective,
  });

  const setCompat = async (f, valor) => {
    setActualizando(f.id);
    try {
      await base44.entities.FichaTecnicaEquipo.update(f.id, { compatibilidad_motor_variador: valor });
      qc.invalidateQueries({ queryKey: ['ing-fichas', effective] });
    } finally { setActualizando(null); }
  };

  return (
    <div>
      <PageHeader title="Fichas Técnicas" subtitle="Especificaciones de equipos y compatibilidad motor↔variador" icon={FileCog} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <span className="text-sm text-muted-foreground ml-auto">{fichas.length} ficha(s)</span>
        </div>

        {isLoading && <div className="p-4 text-center text-muted-foreground">Cargando…</div>}
        {!isLoading && fichas.length === 0 && <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">Sin fichas técnicas.</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fichas.map(f => {
            const Ico = COMP_ICON[f.compatibilidad_motor_variador] || HelpCircle;
            return (
              <div key={f.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{f.tag_equipo || 'Equipo sin TAG'}</div>
                    <div className="text-xs text-muted-foreground">{f.equipo_tipo} · {f.fabricante} {f.modelo}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${ESTADO_STYLE[f.estado] || ''}`}>{f.estado?.replace(/_/g, ' ')}</span>
                </div>

                {f.equipo_asociado && (
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground">Equipo asociado: </span>
                    <span className="text-xs">{f.equipo_asociado}</span>
                  </div>
                )}

                <div className="bg-muted/40 rounded-lg p-2 mb-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Especificaciones clave</div>
                  {f.especificacion_clave && Object.keys(f.especificacion_clave).length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      {Object.entries(f.especificacion_clave).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-mono text-right">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Sin especificaciones.</span>}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${COMP_STYLE[f.compatibilidad_motor_variador] || COMP_STYLE.no_aplica}`}>
                    <Ico className="w-3 h-3" /> motor↔variador: {f.compatibilidad_motor_variador?.replace(/_/g, ' ')}
                  </span>
                  {f.motivo_compatibilidad && <span className="text-xs text-muted-foreground line-clamp-1" title={f.motivo_compatibilidad}>{f.motivo_compatibilidad}</span>}
                </div>
                <div className="flex gap-1 mt-2">
                  {['ok', 'revisar', 'incompatible', 'no_aplica'].map(v => (
                    <button key={v} onClick={() => setCompat(f, v)} disabled={actualizando === f.id}
                      className={`text-xs px-2 py-1 rounded border min-h-[32px] ${f.compatibilidad_motor_variador === v ? COMP_STYLE[v] : 'bg-background border-border text-muted-foreground hover:border-teal-300'}`}>
                      {v.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}