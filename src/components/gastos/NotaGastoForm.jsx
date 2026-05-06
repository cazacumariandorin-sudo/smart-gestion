import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import OcrUploader from './OcrUploader';
import ObraSelector from './ObraSelector';
import { Loader2, AlertTriangle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIAS = ['material', 'combustible', 'peaje', 'parking', 'otros'];

const defaultForm = {
  categoria: '',
  concepto: '',
  importe: '',
  nif_comercio: '',
  nombre_comercio: '',
  fecha_documento: '',
  obra_id: '',
  obra_name: '',
  obra_tipo: '',
};

export default function NotaGastoForm({ open, onClose, onCreated, operario }) {
  const [form, setForm] = useState(defaultForm);
  const [archivos, setArchivos] = useState([]);
  const [ocrRaw, setOcrRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDupAlert, setShowDupAlert] = useState(false);
  const [posibleDup, setPosibleDup] = useState(null);

  const { data: notasExistentes = [] } = useQuery({
    queryKey: ['notas_gasto_check'],
    queryFn: () => base44.entities.NotaGasto.filter({ operario_id: operario?.id }),
    enabled: !!operario?.id,
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleOcrDatos = (datos) => {
    if (datos.concepto) setField('concepto', datos.concepto);
    if (datos.importe) setField('importe', String(datos.importe));
    if (datos.nif_comercio) setField('nif_comercio', datos.nif_comercio);
    if (datos.nombre_comercio) setField('nombre_comercio', datos.nombre_comercio);
    if (datos.fecha_documento) setField('fecha_documento', datos.fecha_documento);
    if (datos.categoria_sugerida) setField('categoria', datos.categoria_sugerida);
    if (datos.ocr_raw) setOcrRaw(datos.ocr_raw);
  };

  const checkDuplicado = () => {
    if (!form.fecha_documento || !form.nombre_comercio || !form.importe) return null;
    return notasExistentes.find(n =>
      n.fecha_documento === form.fecha_documento &&
      n.nombre_comercio?.toLowerCase() === form.nombre_comercio?.toLowerCase() &&
      Math.abs((n.importe || 0) - parseFloat(form.importe || 0)) < 0.01 &&
      n.estado !== 'rechazada'
    ) || null;
  };

  const handleSubmit = async () => {
    if (!form.categoria || !form.importe) {
      toast.error('Categoría e importe son obligatorios');
      return;
    }

    const dup = checkDuplicado();
    if (dup && !posibleDup) {
      setPosibleDup(dup);
      setShowDupAlert(true);
      return;
    }

    setLoading(true);
    try {
      const resNum = await base44.functions.invoke('generarNumeroNota', {});
      const { numero_nota, numero_secuencia } = resNum.data;

      const hoy = format(new Date(), 'yyyy-MM-dd');
      const fechaDoc = form.fecha_documento || hoy;
      const esTardio = false; // solo aplica si la nota destino ya está cerrada (se gestiona al asignar)

      await base44.entities.NotaGasto.create({
        numero_nota,
        numero_secuencia,
        operario_id: operario?.id,
        operario_name: operario?.name || operario?.full_name,
        categoria: form.categoria,
        concepto: form.concepto,
        importe: parseFloat(form.importe),
        nif_comercio: form.nif_comercio,
        nombre_comercio: form.nombre_comercio,
        fecha_documento: fechaDoc,
        fecha_creacion_real: hoy,
        obra_id: form.obra_id || null,
        obra_name: form.obra_name || null,
        obra_tipo: form.obra_tipo || null,
        estado: 'pendiente',
        archivos,
        ocr_raw: ocrRaw,
        ocr_status: ocrRaw ? 'procesado' : 'pendiente',
        es_gasto_tardio: esTardio,
        es_posible_duplicado: !!dup,
        duplicado_confirmado: !!posibleDup,
      });

      toast.success(`Nota ${numero_nota} creada`);
      setForm(defaultForm);
      setArchivos([]);
      setOcrRaw('');
      setPosibleDup(null);
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error('Error al crear nota: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Nota de Gasto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* OCR Upload */}
            <OcrUploader
              onDatosExtraidos={handleOcrDatos}
              onArchivoSubido={(a) => setArchivos(prev => [...prev, a])}
            />

            {archivos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {archivos.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
                    <FileCheck className="w-3 h-3" /> {a.nombre}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría *</Label>
                <MobileSelect value={form.categoria} onValueChange={v => setField('categoria', v)} placeholder="Categoría">
                  {CATEGORIAS.map(c => (
                    <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>
                  ))}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Importe (€) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.importe} onChange={e => setField('importe', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Concepto</Label>
              <Input placeholder="Descripción del gasto" value={form.concepto} onChange={e => setField('concepto', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Comercio / Proveedor</Label>
                <Input placeholder="Nombre comercio" value={form.nombre_comercio} onChange={e => setField('nombre_comercio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NIF / CIF</Label>
                <Input placeholder="B12345678" value={form.nif_comercio} onChange={e => setField('nif_comercio', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fecha del documento</Label>
              <Input type="date" value={form.fecha_documento} onChange={e => setField('fecha_documento', e.target.value)} />
            </div>

            <ObraSelector
              value={form.obra_id}
              obraName={form.obra_name}
              obraTipo={form.obra_tipo}
              onChange={({ obra_id, obra_name, obra_tipo }) => setForm(f => ({ ...f, obra_id, obra_name, obra_tipo }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Crear Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta duplicado */}
      <AlertDialog open={showDupAlert} onOpenChange={setShowDupAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Posible duplicado detectado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ya existe una nota con el mismo día, comercio e importe:<br />
              <strong>{posibleDup?.numero_nota}</strong> — {posibleDup?.concepto}<br />
              ¿Confirmas que este gasto es diferente y no es un duplicado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPosibleDup(null); setShowDupAlert(false); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupAlert(false); handleSubmit(); }}>
              Sí, es un gasto diferente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}