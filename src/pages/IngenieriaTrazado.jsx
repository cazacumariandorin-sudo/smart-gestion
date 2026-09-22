import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Spline, Plus, Trash2, Loader2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';

const TIPOS_TRAZADO = ['cable_electrico', 'tuberia_proceso', 'canal', 'conducto', 'otro'];
const FACTOR_DEFAULT = { cable_electrico: 1.3, tuberia_proceso: 1.4, canal: 1.2, conducto: 1.3, otro: 1.3 };

export default function IngenieriaTrazado() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ origen: '', destino: '', tipo: 'cable_electrico', factor: 1.3, distancia_linea: '', tag: '', notas: '' });

  const effective = obraId || obras[0]?.id;

  const { data: equipos = [] } = useQuery({ queryKey: ['ing-equipos-obra', effective], queryFn: async () => effective ? base44.entities.UbicacionEquipo.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });
  const { data: trazados = [] } = useQuery({ queryKey: ['ing-trazados', effective], queryFn: async () => effective ? base44.entities.TrazadoEstimado.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });

  const guardar = async () => {
    if (!form.origen || !form.destino || !form.distancia_linea) return;
    setGuardando(true);
    try {
      await base44.entities.TrazadoEstimado.create({
        obra_id: effective,
        ubicacion_origen_id: form.origen,
        ubicacion_destino_id: form.destino,
        tipo_trazado: form.tipo,
        factor_trazado: +form.factor,
        distancia_linea_recta_m: +form.distancia_linea,
        distancia_estimada_m: Math.round(+form.distancia_linea * +form.factor * 100) / 100,
        tag_circuito_asociado: form.tag,
        estimado_por: user?.email || '',
        fecha: new Date().toISOString(),
        notas: form.notas,
      });
      setForm({ origen: '', destino: '', tipo: 'cable_electrico', factor: 1.3, distancia_linea: '', tag: '', notas: '' });
      qc.invalidateQueries({ queryKey: ['ing-trazados', effective] });
    } finally { setGuardando(false); }
  };

  const borrar = async (id) => { await base44.entities.TrazadoEstimado.delete(id); qc.invalidateQueries({ queryKey: ['ing-trazados', effective] }); };
  const eqLabel = (id) => { const e = equipos.find(x => x.id === id); return e ? `${e.tag_equipo} (${e.tipo.replace(/_/g, ' ')})` : '—'; };

  return (
    <div>
      <PageHeader title="Trazado Estimado" subtitle="Distancia estimada entre equipos (factor de trazado)" icon={Spline} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <span className="text-sm text-muted-foreground ml-auto">{trazados.length} trazado(s)</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Nuevo trazado</h3>
            <Field label="Equipo origen"><select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} className="ing-input"><option value="">—</option>{equipos.map(e => <option key={e.id} value={e.id}>{e.tag_equipo}</option>)}</select></Field>
            <Field label="Equipo destino"><select value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} className="ing-input"><option value="">—</option>{equipos.map(e => <option key={e.id} value={e.id}>{e.tag_equipo}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo de trazado"><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, factor: FACTOR_DEFAULT[e.target.value] })} className="ing-input">{TIPOS_TRAZADO.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></Field>
              <Field label="Factor de trazado"><input type="number" step="0.1" value={form.factor} onChange={e => setForm({ ...form, factor: e.target.value })} className="ing-input" /></Field>
            </div>
            <Field label="Distancia línea recta (m)"><input type="number" step="0.01" value={form.distancia_linea} onChange={e => setForm({ ...form, distancia_linea: e.target.value })} className="ing-input" /></Field>
            <Field label="TAG/circuito asociado"><input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="B1, alimentación cuadro clima…" className="ing-input" /></Field>
            <Field label="Notas"><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} className="ing-input" /></Field>
            {form.distancia_linea && form.factor && <div className="text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-lg p-2">Distancia estimada: <b>{(+form.distancia_linea * +form.factor).toFixed(2)} m</b></div>}
            <button onClick={guardar} disabled={guardando || !form.origen || !form.destino || !form.distancia_linea} className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar trazado
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl">
            <div className="p-3 border-b border-border font-semibold text-sm">Trazados estimados</div>
            <div className="divide-y divide-border max-h-[65vh] overflow-y-auto">
              {trazados.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin trazados. Marca equipos en «Marcado de Equipos» primero.</div>}
              {trazados.map(t => (
                <div key={t.id} className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{eqLabel(t.ubicacion_origen_id)} → {eqLabel(t.ubicacion_destino_id)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.tipo_trazado.replace(/_/g, ' ')} · TAG: {t.tag_circuito_asociado || '—'}</div>
                    <div className="text-xs mt-0.5">Recta: {t.distancia_linea_recta_m}m × {t.factor_trazado} = <b className="text-teal-700">{t.distancia_estimada_m?.toFixed(2)}m</b></div>
                  </div>
                  <button onClick={() => borrar(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md min-h-[36px]"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-0.5">{children}</div></div>;
}