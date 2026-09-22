import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { BadgeCheck, Plus, Loader2, X, Send, Check } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

const ESTADO_STYLE = {
  borrador: 'bg-slate-100 text-slate-700',
  emitida: 'bg-blue-50 text-blue-700',
  abonada: 'bg-emerald-50 text-emerald-700',
  rechazada: 'bg-red-50 text-red-700',
};

export default function IngenieriaCertificacion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambiando, setCambiando] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [numero, setNumero] = useState('');
  const [selPartidas, setSelPartidas] = useState({}); // { partidaId: { cantidad, porcentaje } }

  const effective = obraId || obras[0]?.id;

  const { data: certs = [] } = useQuery({ queryKey: ['ing-certs', effective], queryFn: async () => effective ? base44.entities.Certificacion.filter({ obra_id: effective }, '-created_date', 100) : [], enabled: !!effective });
  const { data: partidas = [] } = useQuery({ queryKey: ['ing-partidas', effective], queryFn: async () => effective ? base44.entities.PartidaPedido.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });

  const importeTotal = useMemo(() => {
    return Object.entries(selPartidas).reduce((s, [pid, v]) => {
      const p = partidas.find(x => x.id === pid);
      if (!p) return s;
      return s + ((v.porcentaje || 0) / 100) * (p.total || 0);
    }, 0);
  }, [selPartidas, partidas]);

  const togglePartida = (pid) => setSelPartidas(s => { const n = { ...s }; if (n[pid]) delete n[pid]; else n[pid] = { cantidad: 0, porcentaje: 0 }; return n; });
  const setVal = (pid, field, val) => setSelPartidas(s => ({ ...s, [pid]: { ...s[pid], [field]: val } }));

  const crear = async () => {
    setGuardando(true);
    try {
      const partidasArr = Object.entries(selPartidas).map(([partida_pedido_id, v]) => {
        const p = partidas.find(x => x.id === partida_pedido_id);
        const importe = ((v.porcentaje || 0) / 100) * (p?.total || 0);
        return { partida_pedido_id, cantidad_certificada: +v.cantidad || 0, porcentaje_certificado: +v.porcentaje || 0, importe_certificado: Math.round(importe * 100) / 100 };
      }).filter(x => x.porcentaje_certificado > 0 || x.cantidad_certificada > 0);
      await base44.entities.Certificacion.create({
        obra_id: effective,
        numero_cert: numero || `CER-${String(certs.length + 1).padStart(3, '0')}`,
        fecha,
        partidas: partidasArr,
        importe_total_cert: Math.round(importeTotal * 100) / 100,
        estado: 'borrador',
        emitida_por: user?.email || '',
      });
      setShowForm(false); setNumero(''); setSelPartidas({});
      qc.invalidateQueries({ queryKey: ['ing-certs', effective] });
    } finally { setGuardando(false); }
  };

  const cambiarEstado = async (c, nuevo) => {
    setCambiando(c.id);
    try { await base44.entities.Certificacion.update(c.id, { estado: nuevo }); qc.invalidateQueries({ queryKey: ['ing-certs', effective] }); }
    finally { setCambiando(null); }
  };

  return (
    <div>
      <PageHeader title="Certificaciones" subtitle="Certificaciones de obra a partir de partidas" icon={BadgeCheck} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <button onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva certificación
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Nº certificación</label><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="CER-001" className="ing-input" /></div>
              <div><label className="text-xs text-muted-foreground">Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="ing-input" /></div>
            </div>
            <div className="text-xs font-medium text-muted-foreground">Partidas a certificar</div>
            <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border">
              {partidas.map(p => {
                const sel = !!selPartidas[p.id];
                return (
                  <div key={p.id} className={`p-2 ${sel ? 'bg-teal-50/50' : ''}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sel} onChange={() => togglePartida(p.id)} />
                      <span className="font-mono text-xs">{p.posicion}</span>
                      <span className="text-sm flex-1 truncate">{p.descripcion}</span>
                      <span className="text-xs text-muted-foreground">{moneda(p.total)}</span>
                    </label>
                    {sel && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pl-6">
                        <div><label className="text-[10px] text-muted-foreground">% certificado</label><input type="number" min="0" max="100" value={selPartidas[p.id].porcentaje} onChange={e => setVal(p.id, 'porcentaje', e.target.value)} className="ing-input" /></div>
                        <div><label className="text-[10px] text-muted-foreground">Cantidad</label><input type="number" value={selPartidas[p.id].cantidad} onChange={e => setVal(p.id, 'cantidad', e.target.value)} className="ing-input" /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Importe total: <b>{moneda(importeTotal)}</b></span>
              <button onClick={crear} disabled={guardando} className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crear certificación
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {certs.length === 0 && !showForm && <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">Sin certificaciones.</div>}
          {certs.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold flex items-center gap-2">{c.numero_cert}<span className={`text-xs px-2 py-0.5 rounded ${ESTADO_STYLE[c.estado]}`}>{c.estado}</span></div>
                  <div className="text-xs text-muted-foreground">{c.fecha} · {c.partidas?.length || 0} partida(s) · Emitida por {c.emitida_por}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{moneda(c.importe_total_cert)}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {c.estado === 'borrador' && <button onClick={() => cambiarEstado(c, 'emitida')} disabled={cambiando === c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 min-h-[32px]"><Send className="w-3 h-3" /> Emitir</button>}
                {c.estado === 'emitida' && <button onClick={() => cambiarEstado(c, 'abonada')} disabled={cambiando === c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 min-h-[32px]"><Check className="w-3 h-3" /> Marcar abonada</button>}
                {c.estado !== 'rechazada' && c.estado !== 'abonada' && <button onClick={() => cambiarEstado(c, 'rechazada')} disabled={cambiando === c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 min-h-[32px]"><X className="w-3 h-3" /> Rechazar</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}