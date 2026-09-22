import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Maximize, Plus, Trash2, Loader2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';

const METODOS = ['cota_conocida', 'circuito_potencia_ya_medido'];
const CONFIANZA = ['alta', 'media', 'baja'];

export default function IngenieriaPlanos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [drawingId, setDrawingId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre_planta: '', p1x: '', p1y: '', p2x: '', p2y: '', distancia: '', metodo: 'cota_conocida', confianza: 'media', notas: '' });

  const effective = obraId || obras[0]?.id;

  const { data: planos = [] } = useQuery({
    queryKey: ['ing-planos', effective],
    queryFn: async () => effective ? base44.entities.Drawing.filter({ obra_id: effective }, '-created_date', 100) : [],
    enabled: !!effective,
  });
  const { data: calibraciones = [] } = useQuery({
    queryKey: ['ing-calib', drawingId],
    queryFn: async () => drawingId ? base44.entities.PlanoCalibracion.filter({ drawing_id: drawingId }, '-fecha_calibracion', 50) : [],
    enabled: !!drawingId,
  });

  const escala = (p1, p2, dist) => {
    const dx = (p2.x - p1.x), dy = (p2.y - p1.y);
    const px = Math.sqrt(dx * dx + dy * dy);
    return dist > 0 ? px / dist : null;
  };

  const guardar = async () => {
    if (!drawingId || !form.distancia) return;
    const p1 = { x: +form.p1x, y: +form.p1y }, p2 = { x: +form.p2x, y: +form.p2y };
    const esc = escala(p1, p2, +form.distancia);
    if (!esc) return;
    setGuardando(true);
    try {
      await base44.entities.PlanoCalibracion.create({
        drawing_id: drawingId,
        obra_id: effective,
        obra_name: obras.find(o => o.id === effective)?.name?.trim() || '',
        nombre_planta: form.nombre_planta,
        punto_calibracion_1: p1,
        punto_calibracion_2: p2,
        distancia_real_calibracion_m: +form.distancia,
        escala_px_por_metro: Math.round(esc * 1000) / 1000,
        metodo_calibracion: form.metodo,
        confianza_calibracion: form.confianza,
        fecha_calibracion: new Date().toISOString(),
        calibrado_por: user?.email || '',
        notas: form.notas,
      });
      setForm({ nombre_planta: '', p1x: '', p1y: '', p2x: '', p2y: '', distancia: '', metodo: 'cota_conocida', confianza: 'media', notas: '' });
      qc.invalidateQueries({ queryKey: ['ing-calib', drawingId] });
    } finally { setGuardando(false); }
  };

  const borrar = async (id) => {
    await base44.entities.PlanoCalibracion.delete(id);
    qc.invalidateQueries({ queryKey: ['ing-calib', drawingId] });
  };

  return (
    <div>
      <PageHeader title="Calibración de Planos" subtitle="Escala px/metro para medir distancias reales" icon={Maximize} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <ProyectoSelector value={effective} onChange={id => { setObraId(id); setDrawingId(''); }} />
          <select value={drawingId} onChange={e => setDrawingId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[40px]">
            <option value="">— Selecciona plano —</option>
            {planos.map(p => <option key={p.id} value={p.id}>{p.title} {p.reference ? `(${p.reference})` : ''}</option>)}
          </select>
        </div>

        {drawingId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">Nueva calibración</h3>
              <Field label="Nombre de planta/estancia"><input value={form.nombre_planta} onChange={e => setForm({ ...form, nombre_planta: e.target.value })} placeholder="Planta Baja, Sala de Máquinas…" className="ing-input" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Punto 1 X (px)"><input type="number" value={form.p1x} onChange={e => setForm({ ...form, p1x: e.target.value })} className="ing-input" /></Field>
                <Field label="Punto 1 Y (px)"><input type="number" value={form.p1y} onChange={e => setForm({ ...form, p1y: e.target.value })} className="ing-input" /></Field>
                <Field label="Punto 2 X (px)"><input type="number" value={form.p2x} onChange={e => setForm({ ...form, p2x: e.target.value })} className="ing-input" /></Field>
                <Field label="Punto 2 Y (px)"><input type="number" value={form.p2y} onChange={e => setForm({ ...form, p2y: e.target.value })} className="ing-input" /></Field>
              </div>
              <Field label="Distancia real entre puntos (m)"><input type="number" step="0.01" value={form.distancia} onChange={e => setForm({ ...form, distancia: e.target.value })} className="ing-input" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Método"><select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} className="ing-input">{METODOS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></Field>
                <Field label="Confianza"><select value={form.confianza} onChange={e => setForm({ ...form, confianza: e.target.value })} className="ing-input">{CONFIANZA.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
              </div>
              <Field label="Notas"><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} className="ing-input" /></Field>
              {form.p1x && form.p2x && form.distancia && (() => {
                const esc = escala({ x: +form.p1x, y: +form.p1y }, { x: +form.p2x, y: +form.p2y }, +form.distancia);
                return esc ? <div className="text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-lg p-2">Escala calculada: <b>{(esc).toFixed(3)} px/m</b></div> : null;
              })()}
              <button onClick={guardar} disabled={guardando || !form.distancia} className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar calibración
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl">
              <div className="p-3 border-b border-border font-semibold text-sm">Calibraciones ({calibraciones.length})</div>
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {calibraciones.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin calibraciones.</div>}
                {calibraciones.map(c => (
                  <div key={c.id} className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{c.nombre_planta || 'Sin nombre'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Escala: <b>{c.escala_px_por_metro?.toFixed(3)} px/m</b> · {c.metodo_calibracion?.replace(/_/g, ' ')} · {c.confianza_calibracion}
                      </div>
                      <div className="text-xs text-muted-foreground">P1({c.punto_calibracion_1?.x},{c.punto_calibracion_1?.y}) P2({c.punto_calibracion_2?.x},{c.punto_calibracion_2?.y}) = {c.distancia_real_calibracion_m}m</div>
                      <div className="text-xs text-muted-foreground">{new Date(c.fecha_calibracion).toLocaleString('es-ES')} · {c.calibrado_por}</div>
                    </div>
                    <button onClick={() => borrar(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md min-h-[36px]"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-0.5">{children}</div></div>;
}