import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MaterialesOcrDialog from '@/components/materiales/MaterialesOcrDialog';
import NotasGastosSourceDialog from '@/components/materiales/NotasGastosSourceDialog';
import MaterialDocumentoCard from '@/components/materiales/MaterialDocumentoCard';
import MaterialLineaDetalleDialog from '@/components/materiales/MaterialLineaDetalleDialog';
import { ocrDocumentoMateriales } from '@/lib/materialesOcrClient';
import { ScanLine, FileText, Box, FileImage } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';

export default function MaterialesOcr() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const [presetFile, setPresetFile] = useState(null);
  const [lineaDetalle, setLineaDetalle] = useState({ open: false, line: null, doc: null });
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
  const handleSelectFromNota = ({ file_url, registro }) => {
    setNotasOpen(false);
    setPresetFile({ file_url, registro });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setPresetFile(null);
  };

  return (
    <div className="pb-6">
      <PageHeader title="Alta Materiales (OCR+IA)" subtitle="Carga facturas/albaranes y alimenta Materiales + Fabricantes con histórico de precios" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Button onClick={() => setDialogOpen(true)} className="gap-2" size="lg">
            <ScanLine className="w-4 h-4" /> Cargar factura / albarán (OCR+IA)
          </Button>
          <Button onClick={() => setNotasOpen(true)} variant="outline" className="gap-2" size="lg">
            <FileImage className="w-4 h-4" /> Cargar de notas de gastos existentes
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
                <MaterialDocumentoCard key={d.id} doc={d} onLineClick={(line, doc) => setLineaDetalle({ open: true, line, doc })} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MaterialesOcrDialog open={dialogOpen} onClose={handleDialogClose} onSaved={onSaved} presetFile={presetFile} />
      <NotasGastosSourceDialog open={notasOpen} onClose={() => setNotasOpen(false)} onSelect={handleSelectFromNota} onSaved={onSaved} />
      <MaterialLineaDetalleDialog open={lineaDetalle.open} onClose={() => setLineaDetalle({ open: false, line: null, doc: null })} line={lineaDetalle.line} doc={lineaDetalle.doc} />
    </div>
  );
}