import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tags, TrendingUp } from 'lucide-react';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import { moneda } from '@/lib/ingenieriaUtils';
import PageHeader from '@/components/layout/PageHeader';

export default function IngenieriaTarifario() {
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const effective = obraId || obras[0]?.id;

  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ['ing-tarifas', effective],
    queryFn: async () => effective ? base44.entities.MaterialPrecioHistorico.filter({ proyecto_ingenieria_id: effective }, '-fecha_efectiva', 500) : [],
    enabled: !!effective,
  });

  const porConcepto = useMemo(() => {
    const g = {};
    tarifas.forEach(t => {
      const k = t.referencia_concepto || t.material_referencia || '(sin referencia)';
      (g[k] = g[k] || []).push(t);
    });
    return g;
  }, [tarifas]);

  return (
    <div>
      <PageHeader title="Tarifario de Proyectos" subtitle="Tarifas de referencia y precios históricos por concepto" icon={Tags} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ProyectoSelector value={effective} onChange={setObraId} />
          <span className="text-sm text-muted-foreground ml-auto">{tarifas.length} tarifa(s)</span>
        </div>

        {isLoading && <div className="p-4 text-center text-muted-foreground">Cargando…</div>}
        {!isLoading && tarifas.length === 0 && <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">Sin tarifas para este proyecto.</div>}

        <div className="space-y-3">
          {Object.entries(porConcepto).map(([concepto, ts]) => (
            <div key={concepto} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
                <span className="font-semibold text-sm">{concepto}</span>
                <span className="text-xs text-muted-foreground">{ts.length} registro(s)</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Proveedor</th>
                    <th className="text-left p-2">Contratante</th>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Unidad</th>
                    <th className="text-right p-2">Precio neto</th>
                    <th className="text-right p-2">Variación</th>
                    <th className="text-left p-2">Confianza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ts.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="p-2">{t.proveedor_nombre || '—'}</td>
                      <td className="p-2 text-xs">{t.cliente_contratante_name || 'general'}</td>
                      <td className="p-2 text-xs">{t.fecha_efectiva || t.fecha_documento}</td>
                      <td className="p-2 text-xs">{t.unidad_tarifa || 'por_unidad'}</td>
                      <td className="p-2 text-right font-medium">{moneda(t.precio_neto)}</td>
                      <td className={`p-2 text-right text-xs ${t.variacion_pct > 0 ? 'text-red-600' : t.variacion_pct < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {t.variacion_pct != null ? `${t.variacion_pct > 0 ? '+' : ''}${t.variacion_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="p-2 text-xs">{t.confianza}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}