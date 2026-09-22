import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, Check, X, FileSearch } from 'lucide-react';
import { DISCREPANCIA_TIPO_LABEL, SEVERIDAD_STYLE, ESTADO_DISCREP_STYLE, moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

const TIPOS = Object.keys(DISCREPANCIA_TIPO_LABEL);
const ESTADOS = ['abierta', 'revisada', 'resuelta', 'descartada'];

export default function IngenieriaDiscrepancias() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const obraId = params.get('obra_id');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroSev, setFiltroSev] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [resolviendo, setResolviendo] = useState(null);

  const { data: obras = [] } = useQuery({
    queryKey: ['ing-obras'],
    queryFn: async () => base44.entities.Obra.filter({ es_proyecto_ingenieria: true }, '-updated_date', 100),
  });

  const { data: discreps = [], isLoading } = useQuery({
    queryKey: ['ing-discreps-all', obraId],
    queryFn: async () => {
      if (obraId) return base44.entities.Discrepancia.filter({ obra_id: obraId }, '-created_date', 500);
      return base44.entities.Discrepancia.list('-created_date', 500);
    },
  });

  const obraNombre = (id) => obras.find(o => o.id === id)?.name?.trim() || '';

  const filtradas = useMemo(() =>
    discreps.filter(d =>
      (filtroTipo === 'todos' || d.tipo === filtroTipo) &&
      (filtroSev === 'todas' || d.severidad === filtroSev) &&
      (filtroEstado === 'todas' || d.estado === filtroEstado)
    ), [discreps, filtroTipo, filtroSev, filtroEstado]);

  const resolver = async (d, nuevoEstado) => {
    setResolviendo(d.id);
    try {
      await base44.entities.Discrepancia.update(d.id, { estado: nuevoEstado, resuelta_por: '', fecha_resolucion: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ['ing-discreps-all', obraId] });
    } finally {
      setResolviendo(null);
    }
  };

  return (
    <div>
      <PageHeader title="Discrepancias" subtitle="Panel de discrepancias detectadas" icon={AlertTriangle} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {!obraId && (
            <select value="" onChange={e => e.target.value && setParams({ obra_id: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm min-h-[36px]">
              <option value="">Todos los proyectos</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.name?.trim()}</option>)}
            </select>
          )}
          {obraId && <Link to="/ingenieria/discrepancias" className="text-xs text-primary underline">Quitar filtro de proyecto</Link>}
          <Select label="Tipo" value={filtroTipo} onChange={setFiltroTipo} options={['todos', ...TIPOS]} />
          <Select label="Severidad" value={filtroSev} onChange={setFiltroSev} options={['todas', 'alta', 'media', 'baja']} />
          <Select label="Estado" value={filtroEstado} onChange={setFiltroEstado} options={['todas', ...ESTADOS]} />
          <span className="text-sm text-muted-foreground ml-auto">{filtradas.length} resultado(s)</span>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Cargando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <FileSearch className="w-10 h-10 opacity-40" />
              <p>Sin discrepancias para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtradas.map(d => (
                <div key={d.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded border ${SEVERIDAD_STYLE[d.severidad]}`}>{d.severidad}</span>
                      <span className="text-xs font-medium text-teal-700">{DISCREPANCIA_TIPO_LABEL[d.tipo] || d.tipo}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${ESTADO_DISCREP_STYLE[d.estado] || ''}`}>{d.estado}</span>
                      {d.importe_no_facturado != null && <span className="text-xs text-red-600 font-medium">No facturado: {moneda(d.importe_no_facturado)}</span>}
                      {!obraId && d.obra_id && <span className="text-xs text-muted-foreground">{obraNombre(d.obra_id)}</span>}
                    </div>
                    <p className="text-sm">{d.descripcion}</p>
                    {d.tag_afectado && <p className="text-xs text-muted-foreground mt-1">TAG: {d.tag_afectado}</p>}
                  </div>
                  {d.estado === 'abierta' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => resolver(d, 'resuelta')} disabled={resolviendo === d.id} title="Marcar resuelta" className="p-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-50 min-h-[36px]"><Check className="w-4 h-4" /></button>
                      <button onClick={() => resolver(d, 'descartada')} disabled={resolviendo === d.id} title="Descartar" className="p-2 rounded-md bg-slate-50 text-slate-600 border border-slate-200 disabled:opacity-50 min-h-[36px]"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm min-h-[36px]" aria-label={label}>
      {options.map(o => <option key={o} value={o}>{o === 'todos' || o === 'todas' ? `${label}: todas` : o}</option>)}
    </select>
  );
}