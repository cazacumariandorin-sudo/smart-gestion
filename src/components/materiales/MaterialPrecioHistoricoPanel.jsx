import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, History, Loader2, AlertCircle } from 'lucide-react';

const eur = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
    : '—';
};

const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-ES').format(date);
};

/** Precio y comprobante de origen del material seleccionado. */
export default function MaterialPrecioHistoricoPanel({ material }) {
  const [mostrarTodo, setMostrarTodo] = useState(false);
  const materialId = material?.id || '';
  const referencia = material?.referencia || material?.code || '';
  const fabricanteId = material?.fabricante_id || '';

  const { data: historico = [], isLoading, isError } = useQuery({
    queryKey: ['material-precio-historico', materialId, referencia, fabricanteId],
    queryFn: async () => {
      if (materialId) {
        return base44.entities.MaterialPrecioHistorico.filter(
          { material_id: materialId }, '-fecha_documento', 100
        );
      }
      if (!referencia) return [];
      const filters = { material_referencia: referencia };
      if (fabricanteId) filters.fabricante_id = fabricanteId;
      return base44.entities.MaterialPrecioHistorico.filter(filters, '-fecha_documento', 100);
    },
    enabled: !!material && (!!materialId || !!referencia),
    staleTime: 60_000,
  });

  const precios = useMemo(() => [...historico].sort((a, b) =>
    String(b.fecha_documento || '').localeCompare(String(a.fecha_documento || ''))
  ), [historico]);

  if (!material) return null;

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3" aria-label="Historial de precios">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Historial de precios
        </h3>
        <Badge variant="outline" className="text-xs">{precios.length} registro{precios.length === 1 ? '' : 's'}</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 rounded-md bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> No se pudo cargar el histórico. El precio resumido del catálogo no se ha modificado.
        </div>
      ) : precios.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">Sin entradas de precio vinculadas a este material.</p>
      ) : (
        <>
          <div className="space-y-2">
            {precios.slice(0, mostrarTodo ? 100 : 5).map((precio) => (
              <article key={precio.id} className="rounded-lg border p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{eur(precio.precio_neto)} <span className="font-normal text-muted-foreground">/ {precio.unidad || material.unit || 'ud'} · neto</span></p>
                    <p className="text-muted-foreground">{dateLabel(precio.fecha_documento)} · {precio.proveedor_nombre || 'Proveedor no indicado'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {precio.confianza && <Badge variant="secondary" className="text-[10px]">Confianza {precio.confianza}</Badge>}
                    {Number.isFinite(Number(precio.variacion_pct)) && precio.variacion_pct !== null && (
                      <Badge variant="outline" className="text-[10px]">{Number(precio.variacion_pct) > 0 ? '+' : ''}{Number(precio.variacion_pct).toFixed(1)}%</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {precio.pvp != null && <span>PVP {eur(precio.pvp)}</span>}
                  {precio.descuento_empresa != null && <span>Descuento {Number(precio.descuento_empresa)}%</span>}
                  {precio.iva != null && <span>IVA {Number(precio.iva)}%</span>}
                  {precio.documento_tipo && <span>{precio.documento_tipo}{precio.documento_numero ? ` · ${precio.documento_numero}` : ''}</span>}
                </div>
                {precio.documento_url && (
                  <a href={precio.documento_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Abrir justificante
                  </a>
                )}
              </article>
            ))}
          </div>
          {precios.length > 5 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setMostrarTodo(v => !v)}>
              {mostrarTodo ? 'Mostrar menos' : `Ver los ${precios.length} registros`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
