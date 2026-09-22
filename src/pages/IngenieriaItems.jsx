import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ListChecks, ArrowRight } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { DOMINIO_LABEL, TIPO_SEÑAL_LABEL } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

export default function IngenieriaItems() {
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const effective = obraId || obras[0]?.id;
  const [filtroRev, setFiltroRev] = useState('todas');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['ing-items', effective],
    queryFn: async () => effective ? base44.entities.ItemLista.filter({ obra_id: effective }, '-created_date', 500) : [],
    enabled: !!effective,
  });

  const revs = useMemo(() => [...new Set(items.map(i => i.revision).filter(Boolean))], [items]);
  const filtradas = filtroRev === 'todas' ? items : items.filter(i => i.revision === filtroRev);

  // Diff entre dos revisiones (las dos últimas si hay)
  const diff = useMemo(() => {
    if (revs.length < 2) return null;
    const [newR, oldR] = revs; // -created_date: newest first
    const tags = r => new Set(items.filter(i => i.revision === r).map(i => i.tag).filter(Boolean));
    const nt = tags(newR), ot = tags(oldR);
    return { newR, oldR, added: [...nt].filter(t => !ot.has(t)), removed: [...ot].filter(t => !nt.has(t)) };
  }, [items, revs]);

  return (
    <div>
      <PageHeader title="Listado de Ítems" subtitle="Puntos BMS y componentes de proceso por revisión" icon={ListChecks} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <ProyectoSelector value={effective} onChange={id => { setObraId(id); setFiltroRev('todas'); }} />
          <select value={filtroRev} onChange={e => setFiltroRev(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[40px]">
            <option value="todas">Todas las revisiones</option>
            {revs.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="text-sm text-muted-foreground ml-auto">{filtradas.length} ítem(s)</span>
        </div>

        {diff && (diff.added.length > 0 || diff.removed.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
            <div className="font-medium text-amber-800 flex items-center gap-1.5">{diff.oldR} <ArrowRight className="w-3.5 h-3.5" /> {diff.newR}</div>
            <div className="mt-1 text-xs text-amber-700">
              {diff.added.length > 0 && <span className="text-emerald-700">+{diff.added.length} añadidos ({diff.added.slice(0, 8).join(', ')}{diff.added.length > 8 ? '…' : ''}) </span>}
              {diff.removed.length > 0 && <span className="text-red-700">−{diff.removed.length} eliminados</span>}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">TAG</th>
                <th className="text-left p-2">Dominio</th>
                <th className="text-left p-2">Señal</th>
                <th className="text-left p-2">Revisión</th>
                <th className="text-left p-2">Zona</th>
                <th className="text-left p-2">Descripción</th>
                <th className="text-left p-2">Confianza</th>
                <th className="text-left p-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtradas.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Sin ítems.</td></tr>}
              {filtradas.map(i => (
                <tr key={i.id} className="hover:bg-muted/30">
                  <td className="p-2 font-mono text-xs">{i.tag}</td>
                  <td className="p-2 text-xs">{DOMINIO_LABEL[i.dominio] || i.dominio}</td>
                  <td className="p-2 text-xs">{i.tipo_señal ? (TIPO_SEÑAL_LABEL[i.tipo_señal] || i.tipo_señal) : '—'}</td>
                  <td className="p-2 text-xs">{i.revision || '—'}</td>
                  <td className="p-2 text-xs">{i.zona || '—'}{i.superficie_zona_m2 ? ` (${i.superficie_zona_m2}m²)` : ''}</td>
                  <td className="p-2">{i.descripcion}</td>
                  <td className="p-2"><ConfBadge c={i.confianza} /></td>
                  <td className="p-2 text-xs">{i.estado?.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfBadge({ c }) {
  const map = { alta: 'bg-emerald-100 text-emerald-700', media: 'bg-amber-100 text-amber-700', baja: 'bg-red-100 text-red-700' };
  return <span className={`text-xs px-1.5 py-0.5 rounded ${map[c] || ''}`}>{c}</span>;
}