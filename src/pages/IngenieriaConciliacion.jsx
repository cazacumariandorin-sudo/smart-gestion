import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GitCompare, Check, Loader2, Link2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

export default function IngenieriaConciliacion() {
  const qc = useQueryClient();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [selPartida, setSelPartida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [selItems, setSelItems] = useState([]);

  const effective = obraId || obras[0]?.id;

  const { data: partidas = [] } = useQuery({ queryKey: ['ing-partidas', effective], queryFn: async () => effective ? base44.entities.PartidaPedido.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });
  const { data: items = [] } = useQuery({ queryKey: ['ing-items', effective], queryFn: async () => effective ? base44.entities.ItemLista.filter({ obra_id: effective }, '-created_date', 500) : [], enabled: !!effective });

  // Última revisión
  const lastRev = useMemo(() => {
    const revs = [...new Set(items.map(i => i.revision).filter(Boolean))];
    return revs[0] || null;
  }, [items]);
  const itemsLast = useMemo(() => (lastRev ? items.filter(i => i.revision === lastRev) : items), [items, lastRev]);

  const partida = partidas.find(p => p.id === selPartida);

  const abrir = (p) => {
    setSelPartida(p.id);
    setSelItems(p.item_lista_ids || []);
  };

  const toggle = (id) => setSelItems(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const guardar = async () => {
    if (!partida) return;
    setGuardando(true);
    try {
      const count = selItems.length;
      const implicito = (partida.es_tanto_alzado || partida.cantidad === 1) && count > 0 && partida.total
        ? Math.round((partida.total / count) * 100) / 100 : null;
      await base44.entities.PartidaPedido.update(partida.id, {
        item_lista_ids: selItems,
        precio_unitario_implicito: implicito ?? partida.precio_unitario_implicito,
        estado: count > 0 ? 'conciliado' : partida.estado,
      });
      qc.invalidateQueries({ queryKey: ['ing-partidas', effective] });
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <PageHeader title="Conciliación Pd/Pr" subtitle="Partidas (pedido/presupuesto) ↔ ítems del listado técnico" icon={GitCompare} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ProyectoSelector value={effective} onChange={id => { setObraId(id); setSelPartida(null); }} />
          {lastRev && <span className="text-xs text-muted-foreground">Revisión vigente: <b>{lastRev}</b> · {itemsLast.length} ítems</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <div className="bg-card border border-border rounded-xl">
            <div className="p-2 border-b border-border font-semibold text-sm">Partidas ({partidas.length})</div>
            <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {partidas.length === 0 && <div className="p-3 text-sm text-muted-foreground">Sin partidas.</div>}
              {partidas.map(p => (
                <button key={p.id} onClick={() => abrir(p)} className={`w-full text-left p-2.5 ${p.id === selPartida ? 'bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-muted/40'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{p.posicion || '—'}</span>
                    {p.estado === 'conciliado' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    {(p.es_tanto_alzado || p.cantidad === 1) && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">bulto</span>}
                  </div>
                  <div className="text-sm line-clamp-2">{p.descripcion}</div>
                  <div className="text-xs text-muted-foreground">{p.referencia || ''} · {moneda(p.total)} · {(p.item_lista_ids || []).length} ítem(s)</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            {!partida ? (
              <div className="text-sm text-muted-foreground text-center py-8">Selecciona una partida para vincular ítems del listado técnico.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{partida.posicion} {partida.referencia}</div>
                    <div className="text-sm text-muted-foreground">{partida.descripcion}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>Total: <b>{moneda(partida.total)}</b></div>
                    <div className="text-xs text-muted-foreground">Cant. pedida: {partida.cantidad}</div>
                  </div>
                </div>

                {(partida.es_tanto_alzado || partida.cantidad === 1) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                    Partida a tanto alzado. Se concilia contra el recuento real de ítems, no por total.
                    {selItems.length > 0 && <> Precio implícito: <b>{moneda(partida.total / selItems.length)}</b>/punto.</>}
                  </div>
                )}

                <div className="text-xs font-medium text-muted-foreground">Vincular ítems de la revisión {lastRev || 'vigente'} ({itemsLast.length})</div>
                <div className="border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border">
                  {itemsLast.length === 0 && <div className="p-3 text-sm text-muted-foreground">Sin ítems en esta revisión.</div>}
                  {itemsLast.map(it => (
                    <label key={it.id} className="flex items-start gap-2 p-2 hover:bg-muted/30 cursor-pointer">
                      <input type="checkbox" checked={selItems.includes(it.id)} onChange={() => toggle(it.id)} className="mt-1" />
                      <div className="min-w-0">
                        <div className="text-sm"><span className="font-mono text-xs">{it.tag}</span> {it.descripcion}</div>
                        <div className="text-xs text-muted-foreground">{it.zona} · {it.dominio.replace(/_/g, ' ')}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Guardar vinculación ({selItems.length})
                  </button>
                  {selItems.length > 0 && <span className="text-sm text-emerald-700">→ marca la partida como conciliada</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}