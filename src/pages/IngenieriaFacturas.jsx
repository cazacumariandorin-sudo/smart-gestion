import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Receipt, Check, Loader2 } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

const ESTADO = ['pendiente_revision', 'confirmado', 'conciliado', 'descartado'];

export default function IngenieriaFacturas() {
  const qc = useQueryClient();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [guardando, setGuardando] = useState(null);

  const effective = obraId || obras[0]?.id;

  const { data: lineas = [] } = useQuery({ queryKey: ['ing-lineasfact', effective], queryFn: async () => effective ? base44.entities.LineaFactura.filter({ obra_id: effective }, '-created_date', 300) : [], enabled: !!effective });
  const { data: partidas = [] } = useQuery({ queryKey: ['ing-partidas', effective], queryFn: async () => effective ? base44.entities.PartidaPedido.filter({ obra_id: effective }, '-created_date', 200) : [], enabled: !!effective });

  const partidaLabel = (id) => { const p = partidas.find(x => x.id === id); return p ? `${p.posicion || ''} ${p.referencia || ''}`.trim() : '—'; };

  const actualizar = async (id, data) => {
    setGuardando(id);
    try { await base44.entities.LineaFactura.update(id, data); qc.invalidateQueries({ queryKey: ['ing-lineasfact', effective] }); }
    finally { setGuardando(null); }
  };

  const totalFacturado = lineas.reduce((s, l) => s + (l.importe_neto || 0), 0);
  const conciliadas = lineas.filter(l => l.partida_pedido_id).length;

  return (
    <div>
      <PageHeader title="Conciliación Fac/Pd" subtitle="Líneas de factura ↔ partidas de pedido" icon={Receipt} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <span className="text-sm text-muted-foreground ml-auto">{lineas.length} línea(s) · {conciliadas} conciliadas · Total: {moneda(totalFacturado)}</span>
        </div>

        {lineas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">
            Sin líneas de factura. Carga facturas desde «Carga de Documentos» (tipo factura) para generar líneas mediante OCR.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Factura</th>
                  <th className="text-left p-2">Referencia</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-right p-2">Cant.</th>
                  <th className="text-right p-2">Precio ud.</th>
                  <th className="text-right p-2">Importe</th>
                  <th className="text-left p-2">Partida</th>
                  <th className="text-left p-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineas.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-2 text-xs">{l.numero_factura || '—'}</td>
                    <td className="p-2 font-mono text-xs">{l.referencia || '—'}</td>
                    <td className="p-2 max-w-xs truncate" title={l.referencia}>{l.referencia || '—'}</td>
                    <td className="p-2 text-right">{l.cantidad_facturada ?? '—'}</td>
                    <td className="p-2 text-right">{moneda(l.precio_unitario_neto)}</td>
                    <td className="p-2 text-right font-medium">{moneda(l.importe_neto)}</td>
                    <td className="p-2">
                      <select
                        value={l.partida_pedido_id || ''}
                        onChange={e => actualizar(l.id, { partida_pedido_id: e.target.value || null, estado: e.target.value ? 'conciliado' : 'pendiente_revision' })}
                        disabled={guardando === l.id}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs min-h-[36px] max-w-[160px]"
                      >
                        <option value="">— sin partida —</option>
                        {partidas.map(p => <option key={p.id} value={p.id}>{p.posicion || ''} {p.referencia || p.descripcion?.slice(0, 20)}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${l.estado === 'conciliado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{l.estado.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Partidas sin factura */}
        {lineas.length > 0 && (
          <div className="bg-card border border-border rounded-xl">
            <div className="p-2 border-b border-border font-semibold text-sm text-sm">Partidas sin línea de factura asociada</div>
            <div className="divide-y divide-border">
              {partidas.filter(p => p.referencia && !lineas.some(l => l.referencia === p.referencia)).map(p => (
                <div key={p.id} className="p-2 flex items-center gap-2 text-sm">
                  <span className="text-red-600 text-xs">⚠</span>
                  <span className="font-mono text-xs">{p.posicion}</span> {p.referencia} — {p.descripcion?.slice(0, 60)}
                  <span className="ml-auto text-muted-foreground text-xs">{moneda(p.total)}</span>
                </div>
              ))}
              {partidas.filter(p => p.referencia && !lineas.some(l => l.referencia === p.referencia)).length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">Todas las partidas con referencia tienen factura asociada.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}