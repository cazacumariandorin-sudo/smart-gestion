import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { MapPin, Plus, Trash2, Loader2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';

const TIPOS_EQ = ['cuadro_control', 'caldera', 'bomba', 'enfriadora', 'sonda', 'valvula', 'climatizador', 'compresor', 'condensador', 'otro'];
const TIPO_COLOR = { cuadro_control: 'bg-blue-500', caldera: 'bg-orange-500', bomba: 'bg-teal-500', enfriadora: 'bg-cyan-500', sonda: 'bg-purple-500', valvula: 'bg-amber-500', climatizador: 'bg-indigo-500', compresor: 'bg-red-500', condensador: 'bg-emerald-500', otro: 'bg-slate-500' };

export default function IngenieriaEquipos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [drawingId, setDrawingId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const imgRef = useRef(null);
  const [form, setForm] = useState({ tag_equipo: '', tipo: 'sonda', etiqueta: '', x_px: '', y_px: '', notas: '' });

  const effective = obraId || obras[0]?.id;

  const { data: planos = [] } = useQuery({ queryKey: ['ing-planos', effective], queryFn: async () => effective ? base44.entities.Drawing.filter({ obra_id: effective }, '-created_date', 100) : [], enabled: !!effective });
  const { data: calibraciones = [] } = useQuery({ queryKey: ['ing-calib', drawingId], queryFn: async () => drawingId ? base44.entities.PlanoCalibracion.filter({ drawing_id: drawingId }, '-fecha_calibracion', 50) : [], enabled: !!drawingId });
  const calibracionVigente = calibraciones[0];
  const { data: equipos = [] } = useQuery({ queryKey: ['ing-equipos', calibracionVigente?.id], queryFn: async () => calibracionVigente?.id ? base44.entities.UbicacionEquipo.filter({ plano_calibracion_id: calibracionVigente.id }, '-created_date', 200) : [], enabled: !!calibracionVigente?.id });

  const plano = planos.find(p => p.id === drawingId);

  const onImageClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setForm(f => ({ ...f, x_px: x, y_px: y }));
  };

  const guardar = async () => {
    if (!calibracionVigente || !form.tag_equipo || !form.x_px) return;
    setGuardando(true);
    try {
      await base44.entities.UbicacionEquipo.create({
        plano_calibracion_id: calibracionVigente.id,
        obra_id: effective,
        tag_equipo: form.tag_equipo,
        tipo: form.tipo,
        equipo_referencia: '',
        x_px: +form.x_px,
        y_px: +form.y_px,
        etiqueta: form.etiqueta || form.tag_equipo,
        fuente: 'marcado_manual',
        marcado_por: user?.email || '',
        fecha_marcado: new Date().toISOString(),
        notas: form.notas,
      });
      setForm({ tag_equipo: '', tipo: 'sonda', etiqueta: '', x_px: '', y_px: '', notas: '' });
      qc.invalidateQueries({ queryKey: ['ing-equipos', calibracionVigente.id] });
    } finally { setGuardando(false); }
  };

  const borrar = async (id) => { await base44.entities.UbicacionEquipo.delete(id); qc.invalidateQueries({ queryKey: ['ing-equipos', calibracionVigente.id] }); };

  return (
    <div>
      <PageHeader title="Marcado de Equipos" subtitle="Ubica equipos sobre el plano calibrado" icon={MapPin} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <ProyectoSelector value={effective} onChange={id => { setObraId(id); setDrawingId(''); }} />
          <select value={drawingId} onChange={e => setDrawingId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[40px]">
            <option value="">— Plano —</option>
            {planos.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {calibracionVigente && <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded">Calibración vigente: {calibracionVigente.escala_px_por_metro?.toFixed(3)} px/m</span>}
        </div>

        {drawingId && !calibracionVigente && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">Este plano no tiene calibración. Crea una en Calibración de Planos antes de marcar equipos.</div>}

        {plano && calibracionVigente && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="bg-card border border-border rounded-xl p-2 relative overflow-hidden">
              <div className="relative inline-block">
                <img ref={imgRef} src={plano.file_url} alt={plano.title} onClick={onImageClick} className="max-w-full max-h-[65vh] object-contain select-none cursor-crosshair" />
                {equipos.map(eq => (
                  <div key={eq.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: eq.x_px, top: eq.y_px }}>
                    <span className={`block w-3 h-3 rounded-full border-2 border-white shadow ${TIPO_COLOR[eq.tipo] || 'bg-slate-500'}`} />
                    <span className="absolute left-3 top-[-2px] text-[10px] bg-white/90 px-1 rounded shadow whitespace-nowrap">{eq.etiqueta || eq.tag_equipo}</span>
                  </div>
                ))}
                {form.x_px && <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: +form.x_px, top: +form.y_px }}><span className="block w-4 h-4 rounded-full border-2 border-teal-600 bg-teal-300/70 animate-pulse" /></div>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 px-1">Clic sobre el plano para fijar la posición del equipo.</p>
            </div>

            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <h3 className="font-semibold text-sm">Nuevo equipo</h3>
                <input value={form.tag_equipo} onChange={e => setForm({ ...form, tag_equipo: e.target.value })} placeholder="TAG (M1, V01, BMS-NODO-3)" className="ing-input" />
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="ing-input">{TIPOS_EQ.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
                <input value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} placeholder="Etiqueta visible (opcional)" className="ing-input" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={form.x_px} onChange={e => setForm({ ...form, x_px: e.target.value })} placeholder="X px" className="ing-input" />
                  <input type="number" value={form.y_px} onChange={e => setForm({ ...form, y_px: e.target.value })} placeholder="Y px" className="ing-input" />
                </div>
                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Notas" className="ing-input" />
                <button onClick={guardar} disabled={guardando || !form.tag_equipo || !form.x_px} className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Marcar equipo
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl">
                <div className="p-2 border-b border-border font-semibold text-sm">Equipos marcados ({equipos.length})</div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {equipos.map(eq => (
                    <div key={eq.id} className="p-2 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${TIPO_COLOR[eq.tipo] || 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono">{eq.tag_equipo}</div>
                        <div className="text-xs text-muted-foreground">{eq.tipo.replace(/_/g, ' ')} · ({eq.x_px},{eq.y_px}) · {eq.fuente.replace(/_/g, ' ')}</div>
                      </div>
                      <button onClick={() => borrar(eq.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded min-h-[32px]"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}