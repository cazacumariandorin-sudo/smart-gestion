import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { ESTADO_RIESGO_LABEL, ESTADO_RIESGO_STYLE, moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

export default function IngenieriaCoste() {
  const qc = useQueryClient();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [conciliando, setConciliando] = useState(false);
  const effective = obraId || obras[0]?.id;

  const { data: analisis = [] } = useQuery({ queryKey: ['ing-analisis', effective], queryFn: async () => effective ? base44.entities.AnalisisCoste.filter({ obra_id: effective }, '-created_date', 300) : [], enabled: !!effective });
  const { data: partidas = [] } = useQuery({ queryKey: ['ing-partidas', effective], queryFn: async () => effective ? base44.entities.PartidaPedido.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });

  const partidaById = useMemo(() => Object.fromEntries(partidas.map(p => [p.id, p])), [partidas]);

  const totales = useMemo(() => {
    let contratado = 0, recalculado = 0, desviacion = 0;
    const porEstado = { sin_datos: 0, dentro_de_rango: 0, fuera_de_rango_revisar: 0, sobrecoste_confirmado: 0, infrafacturado_confirmado: 0 };
    analisis.forEach(a => {
      contratado += a.coste_contratado || 0;
      recalculado += a.coste_recalculado_con_cantidad_real || 0;
      desviacion += a.desviacion || 0;
      if (porEstado[a.estado_riesgo] != null) porEstado[a.estado_riesgo]++;
    });
    return { contratado, recalculado, desviacion, porEstado };
  }, [analisis]);

  const conciliar = async () => {
    if (!effective) return;
    setConciliando(true);
    try {
      await base44.functions.invoke('conciliarProyectoIngenieria', { obra_id: effective });
      qc.invalidateQueries({ queryKey: ['ing-analisis', effective] });
      qc.invalidateQueries({ queryKey: ['ing-discreps', effective] });
    } finally { setConciliando(false); }
  };

  return (
    <div>
      <PageHeader title="Coste y Riesgo" subtitle="Análisis de coste por partida y semáforo de riesgo" icon={TrendingDown} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <button onClick={conciliar} disabled={conciliando || !effective} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${conciliando ? 'animate-spin' : ''}`} /> Recalcular análisis
          </button>
        </div>

        {analisis.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">
            Sin análisis de coste para este proyecto. Las partidas a tanto alzado (por_punto) requieren BaseDePrecio, y las de por_metro_lineal se calculan al recalcular.
            <div className="mt-2 text-xs">Pulsa «Recalcular análisis» para generar el análisis de las partidas con base de precio.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Coste contratado" value={moneda(totales.contratado)} />
              <Card label="Coste recalculado" value={moneda(totales.recalculado)} />
              <Card label="Desviación" value={moneda(totales.desviacion)} tone={totales.desviacion > 0 ? 'red' : totales.desviacion < 0 ? 'emerald' : ''} />
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Por estado de riesgo</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(totales.porEstado).map(([k, v]) => v > 0 && (
                    <span key={k} className={`text-xs px-1.5 py-0.5 rounded border ${ESTADO_RIESGO_STYLE[k]}`}>{ESTADO_RIESGO_LABEL[k]}: {v}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Partida</th>
                    <th className="text-right p-2">Cant. contratada</th>
                    <th className="text-right p-2">Cant. real</th>
                    <th className="text-right p-2">Coste contr.</th>
                    <th className="text-right p-2">Coste recal.</th>
                    <th className="text-right p-2">Desviación</th>
                    <th className="text-left p-2">Riesgo</th>
                    <th className="text-left p-2">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analisis.map(a => {
                    const p = partidaById[a.partida_pedido_id];
                    return (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="p-2">{p ? `${p.posicion || ''} ${p.referencia || ''}`.trim() : '—'}<div className="text-xs text-muted-foreground line-clamp-1">{p?.descripcion}</div></td>
                        <td className="p-2 text-right">{a.cantidad_contratada ?? '—'}</td>
                        <td className="p-2 text-right">{a.cantidad_real_ultima_revision ?? '—'}</td>
                        <td className="p-2 text-right">{moneda(a.coste_contratado)}</td>
                        <td className="p-2 text-right">{a.coste_recalculado_con_cantidad_real != null ? moneda(a.coste_recalculado_con_cantidad_real) : '—'}</td>
                        <td className={`p-2 text-right font-medium ${a.desviacion > 0 ? 'text-red-600' : a.desviacion < 0 ? 'text-emerald-600' : ''}`}>{a.desviacion != null ? moneda(a.desviacion) : '—'}</td>
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded border ${ESTADO_RIESGO_STYLE[a.estado_riesgo]}`}>{ESTADO_RIESGO_LABEL[a.estado_riesgo]}</span></td>
                        <td className="p-2 text-xs">{a.fuente_principal_dato?.replace(/_/g, ' ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, tone }) {
  const c = tone === 'red' ? 'text-red-600' : tone === 'emerald' ? 'text-emerald-600' : '';
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}