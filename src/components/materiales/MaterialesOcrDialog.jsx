import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ScanLine, Upload, CheckCircle2, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import DocumentScanner from './DocumentScanner';
import LineasMaterialesEditor from './LineasMaterialesEditor';
import { toast } from 'sonner';

const TIPOS_DOC = [
  { value: 'factura', label: 'Factura' },
  { value: 'albaran', label: 'Albarán' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'proforma', label: 'Proforma' },
];

export default function MaterialesOcrDialog({ open, onClose, onSaved, operario = null }) {
  const { user } = useAuth();
  const [paso, setPaso] = useState('captura'); // captura | ocr | revision | guardando
  const [scanResult, setScanResult] = useState(null); // { file, preview }
  const [ocrData, setOcrData] = useState(null); // datos crudos del OCR
  const [ocrError, setOcrError] = useState('');
  const [metaDoc, setMetaDoc] = useState({ tipo: 'factura', numero: '', fecha: new Date().toISOString().slice(0, 10), proveedor_nombre: '', proveedor_nif: '', obra_id: '', obra_name: '', obra_tipo: '' });
  const [lineas, setLineas] = useState([]);

  useEffect(() => {
    if (open) {
      setPaso('captura');
      setScanResult(null);
      setOcrData(null);
      setOcrError('');
      setMetaDoc({ tipo: 'factura', numero: '', fecha: new Date().toISOString().slice(0, 10), proveedor_nombre: '', proveedor_nif: '', obra_id: '', obra_name: '', obra_tipo: '' });
      setLineas([]);
    }
  }, [open]);

  // Cerrar al guardar // después llama onSaved

  const handleScannerDone = async ({ file, preview }) => {
    if (!file) { toast.error('No se pudo procesar la imagen'); return; }
    setScanResult({ file, preview });
    setPaso('ocr');
    setOcrError('');
    try {
      const subida = await base44.integrations.Core.UploadFile({ file });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo');
      setScanResult(prev => ({ ...prev, file_url }));
      const res = await base44.functions.invoke('procesarFacturaMateriales', { file_url, file_tipo: 'image/jpeg' });
      const data = res?.data;
      if (!data?.success) throw new Error(data?.error || 'OCR no devolvió datos');
      const d = data.datos || {};
      setOcrData({ ...d, modelo: data.modelo, fallback: data.fallback });
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

  const handleSkipScanner = async () => {
    setPaso('ocr');
    setOcrError('');
    // Sin scanner: dejar que el usuario suba manualmente luego /水平的提高menteDocumento
    // Para mantenerlo simple: pedimos file input aquí
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) { setPaso('captura'); return; }
      try {
        const subida = await base44.integrations.Core.UploadFile({ file: f });
        const file_url = subida?.file_url;
        if (!file_url) throw new Error('No se pudo subir el archivo');
        setScanResult({ file: f, preview: URL.createObjectURL(f), file_url });
        const res = await base44.functions.invoke('procesarFacturaMateriales', { file_url, file_tipo: f.type });
        const data = res?.data;
        if (!data?.success) throw new Error(data?.error || 'OCR no devolvió datos');
        const d = data.datos || {};
        setOcrData({ ...d, modelo: data.modelo, fallback: data.fallback });
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
        })),
      };
      const res = await base44.functions.invoke('guardarMaterialesOcr', payload);
      const data = res?.data;
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
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
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
          <DocumentScanner onDone={handleScannerDone} onSkip={handleSkipScanner} />
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

            {/* Metadata del documento */}
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

            {/* Tabla editable de líneas */}
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
      </DialogContent>
    </Dialog>
  );
}