import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MaterialesOcrDialog from '@/components/materiales/MaterialesOcrDialog';
import NotasGastosSourceDialog from '@/components/materiales/NotasGastosSourceDialog';
import { ocrDocumentoMateriales } from '@/lib/materialesOcrClient';
import { ScanLine, FileText, ExternalLink, Plus, Box, FileImage } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';

const TIPO_LABEL = { factura: 'Factura', albaran: 'Albarán', ticket: 'Ticket', proforma: 'Proforma' };
const TIPO_COLOR = {
  factura: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  albaran: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  ticket: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  proforma: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
};

export default function MaterialesOcr() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const qc = useQueryClient();
  const { canAccess } = useUserRole();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['materiales_documento_origen'],
    queryFn: () => base44.entities.MaterialDocumentoOrigen.list('-created_date', 50),
  });

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ['materiales_documento_origen'] });
    qc.invalidateQueries({ queryKey: ['material_catalog'] });
    qc.invalidateQueries({ queryKey: ['material_precio_historico'] });
  };

  // Al seleccionar una nota de gasto, abre el diálogo principal con el archivo cargado.
  // El flujo de OCR + revisión + guardado se gestiona dentro de MaterialesOcrDialog.
  const handleSelectFromNota = () => {
    setNotasOpen(false);
    setDialogOpen(true);
  };

  return (
    <div className="pb-6">
      <PageHeader title="Alta Materiales (OCR+IA)" subtitle="Carga facturas/albaranes y alimenta Materiales + Fabricantes con histórico de precios" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Button onClick={() => setDialogOpen(true)} className="gap-2" size="lg">
            <ScanLine className="w-4 h-4" /> Cargar factura / albarán (OCR+IA)
          </Button>
          <p className="text-xs text-muted-foreground">
            Escanea el documento (recorte + enderezado + contraste), el OCR extrae cada línea de producto y la guardas en el catálogo con histórico de precios.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Documentos procesados</h2>
            <span className="text-xs text-muted-foreground">· {docs.length}</span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl">
              <Box className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Todavía no se ha cargado ningún documento.</p>
              <p className="text-xs text-muted-foreground mt-1">Pulsa "Cargar factura / albarán" para empezar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${TIPO_COLOR[d.tipo] || 'bg-slate-100'} border-0`}>{TIPO_LABEL[d.tipo] || d.tipo}</Badge>
                      {d.numero_documento && <span className="text-xs font-mono font-semibold">{d.numero_documento}</span>}
                      {d.proveedor_nombre && <span className="text-xs text-muted-foreground truncate">· {d.proveedor_nombre}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {d.fecha_documento || '—'} · {d.lineas_count || 0} línea{(d.lineas_count || 0) !== 1 ? 's' : ''}
                      {d.obra_name ? ` · ${d.obra_name}` : ''}
                    </p>
                  </div>
                  {d.archivo_url_mejorado && (
                    <a href={d.archivo_url_mejorado} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition" title="Abrir documento">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MaterialesOcrDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={onSaved} />
    </div>
  );
}