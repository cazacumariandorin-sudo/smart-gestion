import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ScanLine, AlertTriangle, Save, RefreshCw, FileImage } from 'lucide-react';
import DocumentScanner from './DocumentScanner';
import LineasMaterialesEditor from './LineasMaterialesEditor';
import NotasGastosSourceDialog from './NotasGastosSourceDialog';
import { ocrDocumentoMateriales, guardarMaterialesOcr } from '@/lib/materialesOcrClient';
import { limpiarPdfSiNecesario } from '@/lib/limpiarPdf';
import { toast } from 'sonner';

const TIPOS_DOC = [
  { value: 'factura', label: 'Factura' },
  { value: 'albaran', label: 'Albarán' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'proforma', label: 'Proforma' },
];

export default function MaterialesOcrDialog({ open, onClose, onSaved, operario = null, presetFile = null }) {
  const { user } = useAuth();
  const [paso, setPaso] = useState('captura');
  const [scanResult, setScanResult] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [ocrError, setOcrError] = useState('');
  const [metaDoc, setMetaDoc] = useState({
    tipo: 'factura',
    numero: '',
    fecha: new Date().toISOString().slice(0, 10),
    proveedor_nombre: '',
    proveedor_nif: '',
    obra_id: '',
    obra_name: '',
    obra_tipo: '',
  });
  const [lineas, setLineas] = useState([]);
  const [notasOpen, setNotasOpen] = useState(false);
  const [notaOrigen, setNotaOrigen] = useState({ id: '', tipo: '' });

  useEffect(() => {
    if (!open) return;
    setPaso('captura');
    setScanResult(null);
    setOcrData(null);
    setOcrError('');
    setNotaOrigen({ id: '', tipo: '' });
    setMetaDoc({ tipo: 'factura', numero: '', fecha: new Date().toISOString().slice(0, 10), proveedor_nombre: '', proveedor_nif: '', obra_id: '', obra_name: '', obra_tipo: '' });
    setLineas([]);
    if (presetFile?.file_url) {
      handleSelectFromNotaGasto(presetFile);
    }
  }, [open]);

  const handleScannerDone = async ({ file, preview }) => {
    if (!file) { toast.error('No se pudo procesar la imagen'); return; }
    setScanResult({ file, preview });
    setPaso('ocr');
    setOcrError('');
    setNotaOrigen({ id: '', tipo: '' });
    try {
      const subida = await base44.integrations.Core.UploadPublicFile({ file });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo');
      setScanResult(prev => ({ ...prev, file_url }));
      const { datos: d, modelo, fallback } = await ocrDocumentoMateriales(file_url, 'image/jpeg');
      setOcrData({ ...d, modelo, fallback });
      setMetaDoc(m => ({
        ...m,
        tipo: d.tipo_documento_inferido && TIPOS_DOC.some(t => t.value === d.tipo_documento_inferido) ? d.tipo_documento_inferido : m.tipo,
        numero: d.numero_documento || m.numero,
        fecha: d.fecha_documento || m.fecha,
        proveedor_nombre: d.proveedor || m.proveedor_nombre,
        proveedor_nif: d.nif_proveedor || m.proveedor_nif,
      }));
      setLineas(Array.isArray(d.lineas) ? d.lineas : []);
      setPaso('revision');
    } catch (err) {
      setOcrError(String(err?.message || err).slice(0, 200));
      setPaso('revision');
    }
  };

  const handleSelectFromNotaGasto = async ({ file_url, registro }) => {
    if (!file_url) { toast.error('La nota de gasto no tiene archivo válido'); return; }
    setPaso('ocr');
    setOcrError('');
    setNotaOrigen({ id: registro?.id || '', tipo: 'nota_gasto' });
    setScanResult({ file: null, preview: file_url, file_url });
    try {
      const { datos: d, modelo, fallback } = await ocrDocumentoMateriales(file_url, registro?.tipo_archivo || 'image/jpeg');
      setOcrData({ ...d, modelo, fallback });
      setMetaDoc(m => ({
        ...m,
        tipo: d.tipo_documento_inferido && TIPOS_DOC.some(t => t.value === d.tipo_documento_inferido) ? d.tipo_documento_inferido : m.tipo,
        numero: d.numero_documento || registro?.numero_factura || m.numero,
        fecha: d.fecha_documento || registro?.fecha_documento || m.fecha,
        proveedor_nombre: d.proveedor || registro?.nombre_comercio || m.proveedor_nombre,
        proveedor_nif: d.nif_proveedor || registro?.nif_comercio || m.proveedor_nif,
        obra_id: registro?.obra_id || m.obra_id,
        obra_name: registro?.obra_name || m.obra_name,
        obra_tipo: registro?.obra_tipo || m.obra_tipo,
      }));
      setLineas(Array.isArray(d.lineas) ? d.lineas : []);
      setPaso('revision');
    } catch (err) {
      setOcrError(String(err?.message || err).slice(0, 200));
      setMetaDoc(m => ({
        ...m,
        numero: registro?.numero_factura || m.numero,
        fecha: registro?.fecha_documento || m.fecha,
        proveedor_nombre: registro?.nombre_comercio || m.proveedor_nombre,
        proveedor_nif: registro?.nif_comercio || m.proveedor_nif,
        obra_id: registro?.obra_id || m.obra_id,
        obra_name: registro?.obra_name || m.obra_name,
      }));
      setPaso('revision');
    }
  };

  const handleSkipScanner = async () => {
    setPaso('ocr');
    setOcrError('');
    setNotaOrigen({ id: '', tipo: '' });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = async (e) => {
      let f = e.target.files?.[0];
      if (!f) { setPaso('captura'); return; }
      try {
        f = await limpiarPdfSiNecesario(f);
        const subida = await base44.integrations.Core.UploadPublicFile({ file: f });
        const file_url = subida?.file_url;
        if (!file_url) throw new Error('No se pudo subir el archivo');
        setScanResult({ file: f, preview: URL.createObjectURL(f), file_url });
        const { datos: d, modelo, fallback } = await ocrDocumentoMateriales(file_url, f.type || 'image/jpeg');
        setOcrData({ ...d, modelo, fallback });
        setMetaDoc(m => ({
          ...m,
          tipo: d.tipo_documento_inferido && TIPOS_DOC.some(t => t.value === d.tipo_documento_inferido) ? d.tipo_documento_inferido : m.tipo,
          numero: d.numero_documento || m.numero,
          fecha: d.fecha_documento || m.fecha,
          proveedor_nombre: d.proveedor || m.proveedor_nombre,
          proveedor_nif: d.nif_proveedor || m.proveedor_nif,
        }));
        setLineas(Array.isArray(d.lineas) ? d.lineas : []);
        setPaso('revision');
      } catch (err) {
        setOcrError(String(err?.message || err).slice(0, 200));
        setPaso('revision');
      }
    };
    input.click();
  };

  const guardar = async () => {
    if (!lineas.length) { toast.error('No hay líneas a guardar'); return; }
    const lineasValidas = lineas.filter(l => l.incluir !== false && (l.descripcion || l.precio_neto));
    if (!lineasValidas.length) { toast.error('Marca al menos una línea con datos'); return; }
    if (!metaDoc.fecha) { toast.error('La fecha del documento es obligatoria'); return; }

    setPaso('guardando');
    try {
      const payload = {
        documento: {
          tipo: metaDoc.tipo,
          numero: metaDoc.numero,
          fecha: metaDoc.fecha,
          proveedor_nombre: metaDoc.proveedor_nombre,
          proveedor_nif: metaDoc.proveedor_nif,
          archivo_url: scanResult?.file_url || '',
          archivo_url_original: scanResult?.file_url || '',
          obra_id: metaDoc.obra_id || '',
          obra_name: metaDoc.obra_name || '',
          operario_id: operario?.id || '',
          nota_gasto_id: notaOrigen.id || '',
          nota_origen_tipo: notaOrigen.tipo || '',
        },
        lineas: lineasValidas.map(l => ({
          fabricante: l.fabricante || '',
          referencia: l.referencia || '',
          descripcion: l.descripcion || '',
          cantidad: Number(l.cantidad || 1),
          unidad: l.unidad || 'ud',
          pvp: l.pvp === '' || l.pvp == null ? null : Number(l.pvp),
          descuento_empresa: l.descuento_empresa === '' || l.descuento_empresa == null ? null : Number(l.descuento_empresa),
          iva: l.iva === '' || l.iva == null ? null : Number(l.iva),
          precio_neto: Number(l.precio_neto || 0),
          confianza: l.confianza || 'media',
        })),
      };
      const data = await guardarMaterialesOcr(payload.documento, payload.lineas);
      if (!data?.success) throw new Error(data?.error || 'Error al guardar');
      const nuevas = (data.resultados || []).filter(r => r.material_existia !== true).length;
      const cambios = (data.resultados || []).filter(r => r.variacion_pct != null).length;
      toast.success(`Procesadas ${data.lineas_guardadas} líneas · ${nuevas} materiales nuevos · ${cambios} cambios de precio`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error('Error al guardar: ' + String(err?.message || err).slice(0, 120));
      setPaso('revision');
    }
  };

  const titulos = {
    captura: 'Cargar documento (escáner CamScanner)',
    ocr: 'Extrayendo materiales…',
    revision: 'Revisar y confirmar líneas',
    guardando: 'Guardando materiales…',
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-primary" />
            {titulos[paso]}
            {ocrData?.fallback && paso === 'revision' && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">IA respaldo</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {paso === 'captura' && (
          <>
            <DocumentScanner onDone={handleScannerDone} onSkip={handleSkipScanner} />
            <div className="pt-3 border-t">
              <Button variant="outline" onClick={() => setNotasOpen(true)} className="w-full gap-2">
                <FileImage className="w-4 h-4" /> Cargar de notas de gastos existentes
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                Busca entre las notas ya cargadas y úsalas como fuente, con función de eliminar duplicados.
              </p>
            </div>
          </>
        )}

        {paso === 'ocr' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Procesando documento con OCR+IA…</p>
          </div>
        )}

        {paso === 'revision' && (
          <div className="space-y-4 py-2">
            {ocrError && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold mb-0.5">OCR: {ocrError}</p>
                  <p>Puedes editar/añadir líneas manualmente abajo.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-muted/30 rounded-xl border">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-[10px]">Tipo</Label>
                <MobileSelect value={metaDoc.tipo} onValueChange={v => setMetaDoc(m => ({ ...m, tipo: v }))} placeholder="Tipo">
                  {TIPOS_DOC.map(t => <MobileSelectItem key={t.value} value={t.value}>{t.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-[10px]">Nº documento</Label>
                <Input value={metaDoc.numero} onChange={e => setMetaDoc(m => ({ ...m, numero: e.target.value }))} className="h-9 text-xs font-mono" placeholder="FAC-2026-001" />
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-[10px]">Fecha</Label>
                <Input type="date" value={metaDoc.fecha} onChange={e => setMetaDoc(m => ({ ...m, fecha: e.target.value }))} className="h-9 text-xs" />
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-[10px]">NIF proveedor</Label>
                <Input value={metaDoc.proveedor_nif} onChange={e => setMetaDoc(m => ({ ...m, proveedor_nif: e.target.value }))} className="h-9 text-xs font-mono" placeholder="B12345678" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-4">
                <Label className="text-[10px]">Proveedor</Label>
                <Input value={metaDoc.proveedor_nombre} onChange={e => setMetaDoc(m => ({ ...m, proveedor_nombre: e.target.value }))} className="h-9 text-xs" placeholder="Nombre del proveedor" />
              </div>
            </div>

            <LineasMaterialesEditor lineas={lineas} onChange={setLineas} />

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Si el OCR no detectó materiales, puedes añadirlos manualmente.</span>
            </div>
          </div>
        )}

        {paso === 'guardando' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Guardando materiales y precios…</p>
          </div>
        )}

        {paso === 'revision' && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={guardar} disabled={paso !== 'revision'} className="gap-2">
              <Save className="w-4 h-4" /> Guardar en Materiales
            </Button>
          </DialogFooter>
        )}

        <NotasGastosSourceDialog
          open={notasOpen}
          onClose={() => setNotasOpen(false)}
          onSelect={handleSelectFromNotaGasto}
        />
      </DialogContent>
    </Dialog>
  );
}