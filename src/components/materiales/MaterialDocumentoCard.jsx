import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, ChevronDown, ChevronRight, Loader2, Euro, Package, AlertCircle } from 'lucide-react';

const TIPO_LABEL = { factura: 'Factura', albaran: 'Albarán', ticket: 'Ticket', proforma: 'Proforma', pedido: 'Pedido', presupuesto: 'Presupuesto', listado_puntos: 'Listado puntos', lista_material: 'Lista material', esquema_conexion: 'Esquema conexión', pid_proceso: 'P&ID proceso', ficha_tecnica_equipo: 'Ficha técnica', plano_planta: 'Plano planta' };
const TIPO_COLOR = {
  factura: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  albaran: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  ticket: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  proforma: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  pedido: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  presupuesto: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200',
  listado_puntos: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  lista_material: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  esquema_conexion: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  pid_proceso: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  ficha_tecnica_equipo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  plano_planta: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
};

// Tipos comerciales → líneas en LineaFactura (con precios). El resto → ItemLista.
const TIPOS_COMERCIALES = ['factura', 'albaran', 'ticket', 'proforma', 'pedido', 'presupuesto'];

const eur = (v) => (typeof v === 'number' && !isNaN(v)) ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v) : '—';

export default function MaterialDocumentoCard({ doc, onLineClick }) {
  const [open, setOpen] = useState(false);
  const esComercial = TIPOS_COMERCIALES.includes(doc.tipo);
  const lineasQuery = useQuery({
    queryKey: ['mat-doc-lineas', doc.id, doc.tipo],
    queryFn: async () => {
      if (esComercial) return { lineas: await base44.entities.LineaFactura.filter({ documento_origen_id: doc.id }), kind: 'factura' };
      return { lineas: await base44.entities.ItemLista.filter({ documento_origen_id: doc.id }), kind: 'item' };
    },
    enabled: open && !!doc.id,
    staleTime: 60000,
  });

  const lineas = lineasQuery.data?.lineas || [];
  const total = esComercial ? lineas.reduce((s, l) => s + (l.importe_neto || 0), 0) : null;
  const lineasCount = doc.lineas_count || lineas.length;

  const toggle = () => setOpen(o => !o);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={toggle}>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${TIPO_COLOR[doc.tipo] || 'bg-slate-100'} border-0`}>{TIPO_LABEL[doc.tipo] || doc.tipo}</Badge>
            {doc.numero_documento && <span className="text-xs font-mono font-semibold">{doc.numero_documento}</span>}
            {doc.proveedor_nombre && <span className="text-xs text-muted-foreground truncate">· {doc.proveedor_nombre}</span>}
            {total != null && total > 0 && (
              <span className="ml-auto text-xs font-semibold text-emerald-600 flex items-center gap-0.5"><Euro className="w-3 h-3" />{eur(total)}</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {doc.fecha_documento || '—'} · {lineasCount} línea{lineasCount !== 1 ? 's' : ''}
            {doc.obra_name ? ` · ${doc.obra_name}` : ''}
            {esComercial ? ' · con precios' : ' · s/precio (ingeniería)'}
          </p>
        </div>
        {doc.archivo_url_mejorado && (
          <a href={doc.archivo_url_mejorado} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="p-2 rounded-lg hover:bg-muted transition shrink-0" title="Abrir documento">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        )}
        <div className="p-1 shrink-0">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/20">
          {lineasQuery.isLoading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando líneas…
            </div>
          ) : lineasQuery.isError ? (
            <div className="p-3 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="w-4 h-4" /> Error al cargar las líneas.
            </div>
          ) : lineas.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />
              Este documento no tiene líneas derivadas registradas.
              {doc.datos_extraidos && Object.keys(doc.datos_extraidos).length > 0 && ' Los datos extraídos sí están guardados en el documento.'}
            </div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {lineas.map((l, i) => {
                const ref = l.referencia || l.referencia_equipo || l.tag || `Línea ${i + 1}`;
                const desc = l.descripcion || l.referencia || '';
                const cant = l.cantidad_facturada ?? l.cantidad;
                const pUnit = l.precio_unitario_neto;
                const imp = l.importe_neto;
                const fab = l.fabricante_name || '';
                return (
                  <button key={l.id || i} onClick={() => onLineClick(l, doc)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold truncate">{ref}</span>
                        {fab && <span className="text-[10px] text-muted-foreground truncate">· {fab}</span>}
                        {l.estado && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{l.estado}</span>}
                      </div>
                      {desc && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{desc}</p>}
                    </div>
                    <div className="text-right shrink-0 text-[11px]">
                      <div className="font-medium">{cant ?? '—'} {l.unidad || 'ud'}</div>
                      {esComercial && (
                        <div className="text-muted-foreground">
                          {pUnit != null ? `${eur(pUnit)}/ud` : '—'} {imp != null ? `· ${eur(imp)}` : ''}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}