import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Edit3, Plus, Trash2, Loader2, ListChecks, ClipboardList, Ruler, Hammer } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

const DOMINIOS = ['control_bms', 'material_electrico_proceso', 'componente_mecanico'];
const SENALES = ['EAP', 'EAA', 'ED', 'EC', 'SAP', 'SA3', 'SD', 'INT'];
const FUENTES_MED = ['medicion_campo', 'plano_planta_estimado', 'esquema_electrico_unifilar', 'estimacion_manual'];
const PRIORIDADES = ['baja', 'media', 'alta'];

const TABS = [
  { id: 'items', label: 'Ítems', icon: ListChecks },
  { id: 'partidas', label: 'Partidas', icon: ClipboardList },
  { id: 'mediciones', label: 'Mediciones reales', icon: Ruler },
  { id: 'extras', label: 'Trabajos extras', icon: Hammer },
];

export default function IngenieriaCambios() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [tab, setTab] = useState('items');
  const [guardando, setGuardando] = useState(false);

  const effective = obraId || obras[0]?.id;
  const obra = obras.find(o => o.id === effective);

  return (
    <div>
      <PageHeader title="Cambios en Obra" subtitle="Alta manual de cambios sobrevenidos durante la ejecución" icon={Edit3} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${tab === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/40'}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {!effective ? (
          <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">Selecciona un proyecto de ingeniería.</div>
        ) : tab === 'items' ? (
          <ItemsTab obraId={effective} obra={obra} user={user} qc={qc} guardando={guardando} setGuardando={setGuardando} />
        ) : tab === 'partidas' ? (
          <PartidasTab obraId={effective} obra={obra} user={user} qc={qc} guardando={guardando} setGuardando={setGuardando} />
        ) : tab === 'mediciones' ? (
          <MedicionesTab obraId={effective} user={user} qc={qc} guardando={guardando} setGuardando={setGuardando} />
        ) : (
          <ExtrasTab obraId={effective} obra={obra} user={user} qc={qc} guardando={guardando} setGuardando={setGuardando} />
        )}
      </div>
    </div>
  );
}

/* ── Ítems (ItemLista) ─────────────────────────────────────── */
function ItemsTab({ obraId, user, qc, guardando, setGuardando }) {
  const [f, setF] = useState({ tag: '', dominio: 'control_bms', tipo_senal: '', zona: '', descripcion: '', revision: 'MANUAL', cantidad: 1, unidad: 'ud' });
  const { data: items = [] } = useQuery({ queryKey: ['ing-items-man', obraId], queryFn: async () => base44.entities.ItemLista.filter({ obra_id: obraId }, '-created_date', 200) });
  const manuales = items.filter(i => i.revision === 'MANUAL');

  const crear = async () => {
    if (!f.tag || !f.descripcion) return;
    setGuardando(true);
    try {
      await base44.entities.ItemLista.create({
        obra_id: obraId, tag: f.tag, dominio: f.dominio, tipo_señal: f.dominio === 'control_bms' ? f.tipo_senal : undefined,
        zona: f.zona, descripcion: f.descripcion, revision: f.revision || 'MANUAL', cantidad: +f.cantidad || 1, unidad: f.unidad,
        estado: 'pendiente_revision', confianza: 'alta', fuente: 'marcado_manual',
      });
      setF({ tag: '', dominio: 'control_bms', tipo_senal: '', zona: '', descripcion: '', revision: 'MANUAL', cantidad: 1, unidad: 'ud' });
      qc.invalidateQueries({ queryKey: ['ing-items-man', obraId] });
    } finally { setGuardando(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Form title="Nuevo ítem (cambio sobrevenido)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="TAG"><input value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} placeholder="AHU01_R3Dmp1Cmd" className="ing-input" /></Field>
          <Field label="Revisión"><input value={f.revision} onChange={e => setF({ ...f, revision: e.target.value })} className="ing-input" /></Field>
          <Field label="Dominio"><select value={f.dominio} onChange={e => setF({ ...f, dominio: e.target.value })} className="ing-input">{DOMINIOS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}</select></Field>
          {f.dominio === 'control_bms' && (
            <Field label="Tipo señal"><select value={f.tipo_senal} onChange={e => setF({ ...f, tipo_señal: e.target.value })} className="ing-input"><option value="">—</option>{SENALES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
          )}
          <Field label="Zona"><input value={f.zona} onChange={e => setF({ ...f, zona: e.target.value })} className="ing-input" /></Field>
          <Field label="Cantidad"><input type="number" value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} className="ing-input" /></Field>
        </div>
        <Field label="Descripción"><textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={2} className="ing-input" /></Field>
        <SaveBtn onClick={crear} guardando={guardando} disabled={!f.tag || !f.descripcion} />
      </Form>
      <List title={`Ítems manuales (${manuales.length})`} empty="Sin ítems manuales.">
        {manuales.map(i => <Row key={i.id} title={i.tag} sub={`${i.dominio.replace(/_/g, ' ')} · ${i.zona || ''} · rev ${i.revision}`} desc={i.descripcion} onDelete={async () => { await base44.entities.ItemLista.delete(i.id); qc.invalidateQueries({ queryKey: ['ing-items-man', obraId] }); }} />)}
      </List>
    </div>
  );
}

/* ── Partidas (PartidaPedido) ──────────────────────────────── */
function PartidasTab({ obraId, obra, user, qc, guardando, setGuardando }) {
  const [f, setF] = useState({ posicion: '', descripcion: '', referencia: '', cantidad: 1, unidad: 'ud', precio_unitario: '', capitulo: '', zona_obra: '', es_tanto_alzado: false });
  const { data: partidas = [] } = useQuery({ queryKey: ['ing-partidas-man', obraId], queryFn: async () => base44.entities.PartidaPedido.filter({ obra_id: obraId }, '-created_date', 200) });

  const total = f.precio_unitario && f.cantidad ? (+f.precio_unitario * +f.cantidad) : null;

  const crear = async () => {
    if (!f.descripcion) return;
    setGuardando(true);
    try {
      await base44.entities.PartidaPedido.create({
        obra_id: obraId, posicion: f.posicion, descripcion: f.descripcion, referencia: f.referencia,
        cantidad: +f.cantidad || 1, unidad: f.unidad, precio_unitario: f.precio_unitario ? +f.precio_unitario : undefined,
        total: total ?? undefined, capitulo: f.capitulo, zona_obra: f.zona_obra,
        es_tanto_alzado: f.es_tanto_alzado, estado: 'pendiente_revision', confianza: 'alta',
      });
      setF({ posicion: '', descripcion: '', referencia: '', cantidad: 1, unidad: 'ud', precio_unitario: '', capitulo: '', zona_obra: '', es_tanto_alzado: false });
      qc.invalidateQueries({ queryKey: ['ing-partidas-man', obraId] });
    } finally { setGuardando(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Form title="Nueva partida (cambio/adición)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Posición"><input value={f.posicion} onChange={e => setF({ ...f, posicion: e.target.value })} placeholder="L1, INSTAL_ELEC_01" className="ing-input" /></Field>
          <Field label="Referencia"><input value={f.referencia} onChange={e => setF({ ...f, referencia: e.target.value })} className="ing-input" /></Field>
          <Field label="Capítulo"><input value={f.capitulo} onChange={e => setF({ ...f, capitulo: e.target.value })} placeholder="01.04" className="ing-input" /></Field>
          <Field label="Zona obra"><input value={f.zona_obra} onChange={e => setF({ ...f, zona_obra: e.target.value })} className="ing-input" /></Field>
          <Field label="Cantidad"><input type="number" value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} className="ing-input" /></Field>
          <Field label="Precio unitario"><input type="number" step="0.01" value={f.precio_unitario} onChange={e => setF({ ...f, precio_unitario: e.target.value })} className="ing-input" /></Field>
        </div>
        <Field label="Descripción"><textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={2} className="ing-input" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.es_tanto_alzado} onChange={e => setF({ ...f, es_tanto_alzado: e.target.checked })} /> Partida a tanto alzado (bulto)</label>
        {total != null && <div className="text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-lg p-2">Total: <b>{moneda(total)}</b></div>}
        <SaveBtn onClick={crear} guardando={guardando} disabled={!f.descripcion} />
      </Form>
      <List title={`Partidas del proyecto (${partidas.length})`} empty="Sin partidas.">
        {partidas.map(p => <Row key={p.id} title={`${p.posicion || ''} ${p.referencia || ''}`.trim() || '—'} sub={`${p.zona_obra || ''} · ${moneda(p.total)} ${p.es_tanto_alzado ? '· bulto' : ''}`} desc={p.descripcion} onDelete={async () => { await base44.entities.PartidaPedido.delete(p.id); qc.invalidateQueries({ queryKey: ['ing-partidas-man', obraId] }); }} />)}
      </List>
    </div>
  );
}

/* ── Mediciones reales (MedicionReal) ─────────────────────── */
function MedicionesTab({ obraId, user, qc, guardando, setGuardando }) {
  const [f, setF] = useState({ tag: '', distancia: '', fecha: new Date().toISOString().slice(0, 10), fuente: 'medicion_campo', observaciones: '' });
  const { data: meds = [] } = useQuery({ queryKey: ['ing-meds-man', obraId], queryFn: async () => base44.entities.MedicionReal.filter({ obra_id: obraId }, '-created_date', 200) });

  const crear = async () => {
    if (!f.tag || !f.distancia) return;
    setGuardando(true);
    try {
      await base44.entities.MedicionReal.create({
        obra_id: obraId, tag_o_circuito: f.tag, distancia_real_m: +f.distancia, fecha_medicion: f.fecha,
        fuente: f.fuente, medido_por: user?.email || '', observaciones: f.observaciones,
      });
      setF({ tag: '', distancia: '', fecha: new Date().toISOString().slice(0, 10), fuente: 'medicion_campo', observaciones: '' });
      qc.invalidateQueries({ queryKey: ['ing-meds-man', obraId] });
    } finally { setGuardando(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Form title="Nueva medición real (campo)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="TAG / circuito"><input value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} placeholder="B1, alimentación cuadro clima" className="ing-input" /></Field>
          <Field label="Distancia real (m)"><input type="number" step="0.01" value={f.distancia} onChange={e => setF({ ...f, distancia: e.target.value })} className="ing-input" /></Field>
          <Field label="Fecha"><input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} className="ing-input" /></Field>
          <Field label="Fuente"><select value={f.fuente} onChange={e => setF({ ...f, fuente: e.target.value })} className="ing-input">{FUENTES_MED.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></Field>
        </div>
        <Field label="Observaciones"><textarea value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} rows={2} className="ing-input" /></Field>
        <SaveBtn onClick={crear} guardando={guardando} disabled={!f.tag || !f.distancia} />
      </Form>
      <List title={`Mediciones reales (${meds.length})`} empty="Sin mediciones.">
        {meds.map(m => <Row key={m.id} title={m.tag_o_circuito} sub={`${m.distancia_real_m} m · ${m.fuente.replace(/_/g, ' ')} · ${m.fecha_medicion}`} desc={m.observaciones} onDelete={async () => { await base44.entities.MedicionReal.delete(m.id); qc.invalidateQueries({ queryKey: ['ing-meds-man', obraId] }); }} />)}
      </List>
    </div>
  );
}

/* ── Trabajos extras (TrabajoExtraObra) ───────────────────── */
function ExtrasTab({ obraId, obra, user, qc, guardando, setGuardando }) {
  const [f, setF] = useState({ descripcion: '', fecha: new Date().toISOString().slice(0, 10), importe: '', prioridad: 'media', notas: '' });
  const { data: extras = [] } = useQuery({ queryKey: ['ing-extras', obraId], queryFn: async () => base44.entities.TrabajoExtraObra.filter({ obra_id: obraId }, '-created_date', 200) });

  const crear = async () => {
    if (!f.descripcion) return;
    setGuardando(true);
    try {
      const d = new Date(f.fecha);
      await base44.entities.TrabajoExtraObra.create({
        obra_id: obraId, obra_name: obra?.name || '', obra_tipo: 'obra_civil',
        client_id: obra?.client_id, client_name: obra?.client_name,
        fecha_solicitud: f.fecha, solicitado_por_email: user?.email || '',
        solicitado_por_nombre: user?.full_name || '', solicitado_por_rol: user?.role || '',
        descripcion: f.descripcion, importe_estimado: f.importe ? +f.importe : undefined,
        prioridad: f.prioridad, estado: 'pendiente', notas_admin: f.notas,
        mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, anio: d.getFullYear(), mes_numero: d.getMonth() + 1,
      });
      setF({ descripcion: '', fecha: new Date().toISOString().slice(0, 10), importe: '', prioridad: 'media', notas: '' });
      qc.invalidateQueries({ queryKey: ['ing-extras', obraId] });
    } finally { setGuardando(false); }
  };

  const marcarFacturado = async (e) => {
    const imp = window.prompt('Importe facturado (€):', e.importe_estimado || '');
    if (imp == null) return;
    await base44.entities.TrabajoExtraObra.update(e.id, { estado: 'facturado', importe_facturado: +imp || 0, fecha_facturacion: new Date().toISOString().slice(0, 10), facturado_por: user?.email || '' });
    qc.invalidateQueries({ queryKey: ['ing-extras', obraId] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Form title="Nuevo trabajo extra vinculado al proyecto">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha"><input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} className="ing-input" /></Field>
          <Field label="Prioridad"><select value={f.prioridad} onChange={e => setF({ ...f, prioridad: e.target.value })} className="ing-input">{PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Importe estimado (€)"><input type="number" step="0.01" value={f.importe} onChange={e => setF({ ...f, importe: e.target.value })} className="ing-input" /></Field>
        </div>
        <Field label="Descripción"><textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={3} className="ing-input" /></Field>
        <Field label="Notas internas"><input value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} className="ing-input" /></Field>
        <SaveBtn onClick={crear} guardando={guardando} disabled={!f.descripcion} label="Vincular trabajo extra" />
      </Form>
      <List title={`Trabajos extras del proyecto (${extras.length})`} empty="Sin trabajos extras vinculados.">
        {extras.map(e => (
          <div key={e.id} className="p-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${e.prioridad === 'alta' ? 'bg-red-100 text-red-700' : e.prioridad === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{e.prioridad}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${e.estado === 'facturado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{e.estado}</span>
              </div>
              <div className="text-sm mt-1">{e.descripcion}</div>
              <div className="text-xs text-muted-foreground">{e.fecha_solicitud} · {e.importe_estimado ? moneda(e.importe_estimado) : '—'}{e.importe_facturado ? ` → fact. ${moneda(e.importe_facturado)}` : ''}</div>
            </div>
            <div className="flex flex-col gap-1">
              {e.estado === 'pendiente' && <button onClick={() => marcarFacturado(e)} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 min-h-[28px]">Facturar</button>}
              <button onClick={async () => { await base44.entities.TrabajoExtraObra.delete(e.id); qc.invalidateQueries({ queryKey: ['ing-extras', obraId] }); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded min-h-[28px]"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </List>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────── */
function Form({ title, children }) {
  return <div className="bg-card border border-border rounded-xl p-4 space-y-2.5"><h3 className="font-semibold text-sm">{title}</h3>{children}</div>;
}
function Field({ label, children }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-0.5">{children}</div></div>;
}
function SaveBtn({ onClick, guardando, disabled, label = 'Guardar' }) {
  return <button onClick={onClick} disabled={guardando || disabled} className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {label}
  </button>;
}
function List({ title, empty, children }) {
  return <div className="bg-card border border-border rounded-xl"><div className="p-2.5 border-b border-border font-semibold text-sm">{title}</div><div className="divide-y divide-border max-h-[65vh] overflow-y-auto">{!children?.props?.children?.length ? <div className="p-3 text-sm text-muted-foreground">{empty}</div> : children}</div></div>;
}
function Row({ title, sub, desc, onDelete }) {
  return (
    <div className="p-2.5 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
        {desc && <div className="text-xs mt-0.5 line-clamp-2">{desc}</div>}
      </div>
      <button onClick={onDelete} className="p-1.5 text-red-600 hover:bg-red-50 rounded min-h-[32px]"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}