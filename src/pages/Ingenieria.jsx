import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Cpu, FileText, AlertTriangle, TrendingDown, RefreshCw, ChevronRight, Building2 } from 'lucide-react';
import { DISCIPLINA_LABEL, SEVERIDAD_STYLE, moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

export default function Ingenieria() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [conciliando, setConciliando] = useState(false);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['ing-obras'],
    queryFn: async () => base44.entities.Obra.filter({ es_proyecto_ingenieria: true }, '-updated_date', 100),
  });

  const obra = obras.find(o => o.id === selectedId) || obras[0];
  const obraId = obra?.id;

  const { data: documentos = [] } = useQuery({
    queryKey: ['ing-docs', obraId],
    queryFn: async () => obraId ? base44.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: obraId }, '-created_date', 200) : [],
    enabled: !!obraId,
  });
  const { data: discreps = [] } = useQuery({
    queryKey: ['ing-discreps', obraId],
    queryFn: async () => obraId ? base44.entities.Discrepancia.filter({ obra_id: obraId }, '-created_date', 200) : [],
    enabled: !!obraId,
  });
  const { data: partidas = [] } = useQuery({
    queryKey: ['ing-partidas', obraId],
    queryFn: async () => obraId ? base44.entities.PartidaPedido.filter({ obra_id: obraId }, '-created_date', 200) : [],
    enabled: !!obraId,
  });

  const sev = { alta: 0, media: 0, baja: 0 };
  discreps.forEach(d => { if (sev[d.severidad] != null) sev[d.severidad]++; });
  const costeContratado = partidas.reduce((s, p) => s + (p.total || 0), 0);

  const conciliar = async () => {
    if (!obraId) return;
    setConciliando(true);
    try {
      await base44.functions.invoke('conciliarProyectoIngenieria', { obra_id: obraId });
      qc.invalidateQueries({ queryKey: ['ing-discreps', obraId] });
      qc.invalidateQueries({ queryKey: ['ing-docs', obraId] });
    } finally {
      setConciliando(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando proyectos…</div>;
  if (!obras.length) return (
    <div className="p-8 text-center">
      <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No hay proyectos de ingeniería. Marca una obra como proyecto de ingeniería para activar el módulo.</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Ingeniería — ObraCheck" subtitle="Auditoría técnico-económica de proyectos" icon={Cpu} />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4">
        {/* Selector de proyectos */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2">Proyectos</h3>
          {obras.map(o => (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${o.id === obraId ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-400' : 'bg-card border-border hover:border-teal-300'}`}
            >
              <div className="font-medium text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-teal-600" />{o.name?.trim()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{o.numero_proyecto || 's/n'} · {DISCIPLINA_LABEL[o.disciplina_ingenieria] || '—'}</div>
            </button>
          ))}
        </div>

        {/* Dashboard del proyecto */}
        <div className="space-y-4">
          {obra && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">{obra.name?.trim()}</h2>
                  <p className="text-sm text-muted-foreground">{obra.numero_proyecto} · {obra.proveedor_instalador} · Contratante: {obra.cliente_contratante_name || '—'}</p>
                </div>
                <button onClick={conciliar} disabled={conciliando} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${conciliando ? 'animate-spin' : ''}`} />{conciliando ? 'Conciliando…' : 'Conciliar proyecto'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={FileText} label="Documentos" value={documentos.length} />
            <StatCard icon={AlertTriangle} label="Discrepancias" value={discreps.length} tone="amber" />
            <StatCard icon={TrendingDown} label="Coste contratado" value={moneda(costeContratado)} />
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-1">Por severidad</div>
              <div className="flex gap-2 flex-wrap">
                {['alta','media','baja'].map(s => (
                  <span key={s} className={`text-xs px-2 py-1 rounded border ${SEVERIDAD_STYLE[s]}`}>{s}: {sev[s]}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-semibold text-sm">Discrepancias recientes</h3>
              <Link to={`/ingenieria/discrepancias${obraId ? `?obra_id=${obraId}` : ''}`} className="text-xs text-primary inline-flex items-center">Ver todas <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {discreps.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin discrepancias. Pulsa «Conciliar proyecto».</div>}
              {discreps.slice(0, 12).map(d => (
                <div key={d.id} className="p-3 flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded border mt-0.5 ${SEVERIDAD_STYLE[d.severidad]}`}>{d.severidad}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted-foreground uppercase">{d.tipo.replace(/_/g, ' ')}</div>
                    <div className="text-sm line-clamp-2">{d.descripcion}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="w-4 h-4" />{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}