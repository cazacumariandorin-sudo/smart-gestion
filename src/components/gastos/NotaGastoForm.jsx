import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ObraSelector from './ObraSelector';
import TicketCapture from './TicketCapture';
import { Loader2, AlertTriangle, RotateCcw, UserCheck, FileCheck } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIAS = ['combustible', 'comida', 'material', 'peaje', 'parking', 'otros'];

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
  notas: '',
};

export default function NotaGastoForm({ open, onClose, onCreated, operario, isAdmin = false, operarios = [] }) {
  const [paso, setPaso] = useState('captura'); // captura | formulario
  const [form, setForm] = useState(defaultForm);
  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrRaw, setOcrRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDupAlert, setShowDupAlert] = useState(false);
  const [posibleDup, setPosibleDup] = useState(null);
  const [operarioSeleccionado, setOperarioSeleccionado] = useState(null);

  const operarioEfectivo = (isAdmin && operarioSeleccionado)
    ? operarios.find(op => op.id === operarioSeleccionado) || operario
    : operario;

  const { data: notasExistentes = [] } = useQuery({
    queryKey: ['notas_gasto_check', operarioEfectivo?.id],
    queryFn: () => base44.entities.NotaGasto.filter({ operario_id: operarioEfectivo?.id }),
    enabled: !!operarioEfectivo?.id,
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Callback desde TicketCapture
  const handleCapturado = (archivoObj, urlPreview, datosOcr) => {
    setArchivo(archivoObj);
    setPreviewUrl(urlPreview);
    if (datosOcr) {
      setForm(f => ({
        ...f,
        concepto: datosOcr.concepto || f.concepto,
        importe: datosOcr.importe ? String(datosOcr.importe) : f.importe,
        nif_comercio: datosOcr.nif_comercio || f.nif_comercio,
        nombre_comercio: datosOcr.nombre_comercio || f.nombre_comercio,
        fecha_documento: datosOcr.fecha_documento || f.fecha_documento,
        categoria: datosOcr.categoria_sugerida || f.categoria,
      }));
      if (datosOcr.ocr_raw) setOcrRaw(datosOcr.ocr_raw);
    }
    setPaso('formulario');
  };

  const handleSaltar = () => {
    setArchivo(null);
    setPreviewUrl(null);
    setPaso('formulario');
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

  const doCreate = async () => {
    if (!operarioEfectivo?.id) {
      toast.error('No se encontró tu perfil de operario. Contacta con administración.');
      return;
    }

    setLoading(true);
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd');

      // Generar número de referencia localmente si la función no está disponible
      let numero_nota = `Reg-${format(new Date(), 'yyyy')}-${Date.now().toString().slice(-6)}`;
      let numero_secuencia = null;
      try {
        const resNum = await base44.functions.invoke('generarNumeroNota', {});
        numero_nota = resNum.data.numero_nota;
        numero_secuencia = resNum.data.numero_secuencia;
      } catch {
        // función no disponible (plan sin backend) — usar referencia local
      }

      await base44.entities.NotaGasto.create({
        numero_nota,
        numero_secuencia,
        operario_id: operarioEfectivo.id,
        operario_name: operarioEfectivo.name || operarioEfectivo.full_name || '',
        categoria: form.categoria,
        concepto: form.concepto || '',
        importe: parseFloat(form.importe),
        nif_comercio: form.nif_comercio || '',
        nombre_comercio: form.nombre_comercio || '',
        fecha_documento: form.fecha_documento || hoy,
        fecha_creacion_real: hoy,
        obra_id: form.obra_id || null,
        obra_name: form.obra_name || null,
        obra_tipo: form.obra_tipo || null,
        estado: 'pendiente',
        archivos: archivo ? [archivo] : [],
        ocr_raw: ocrRaw || '',
        ocr_status: ocrRaw ? 'procesado' : 'pendiente',
        es_gasto_tardio: false,
        es_posible_duplicado: !!posibleDup,
        duplicado_confirmado: !!posibleDup,
      });

      toast.success(`Registro ${numero_nota} creado`);
      resetForm();
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error('Error al crear registro: ' + e.message);
    } finally {
      setLoading(false);
    }
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
    await doCreate();
  };

  const resetForm = () => {
    setForm(defaultForm);
    setArchivo(null);
    setPreviewUrl(null);
    setOcrRaw('');
    setPosibleDup(null);
    setOperarioSeleccionado(null);
    setPaso('captura');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paso === 'captura' ? '📷 Nuevo Registro de Gasto' : '✏️ Datos del Registro'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* PASO 1: Captura de ticket */}
            {paso === 'captura' && (
              <TicketCapture
                onCapturado={handleCapturado}
                onSaltar={handleSaltar}
              />
            )}

            {/* PASO 2: Formulario */}
            {paso === 'formulario' && (
              <>
                {/* Selector de operario — solo para admins */}
                {isAdmin && operarios.length > 0 && (
                  <div className="space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label className="text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                      <UserCheck className="w-3.5 h-3.5" /> Asignar a operario
                    </Label>
                    <MobileSelect
                      value={operarioSeleccionado || ''}
                      onValueChange={v => setOperarioSeleccionado(v || null)}
                      placeholder={`${operario?.name || 'Operario propio'} (por defecto)`}
                    >
                      {operarios.filter(op => op.active !== false).map(op => (
                        <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
                      ))}
                    </MobileSelect>
                    {operarioSeleccionado && (
                      <p className="text-xs text-blue-600">
                        ✓ Se creará en nombre de: <strong>{operarioEfectivo?.name}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Thumbnail del ticket + opción de repetir */}
                {previewUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-accent/30 rounded-lg border">
                    <img src={previewUrl} alt="Ticket" className="h-14 w-14 object-cover rounded-md border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{archivo?.nombre || 'Imagen capturada'}</p>
                      <p className="text-xs text-green-600 flex items-center gap-1"><FileCheck className="w-3 h-3" /> Subido correctamente</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setPaso('captura')} className="shrink-0 gap-1 text-xs">
                      <RotateCcw className="w-3 h-3" /> Cambiar
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setPaso('captura')} className="w-full gap-2 text-muted-foreground">
                    <RotateCcw className="w-4 h-4" /> Añadir imagen del ticket
                  </Button>
                )}

                {/* Fecha del documento */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha del documento</Label>
                  <Input type="date" value={form.fecha_documento} onChange={e => setField('fecha_documento', e.target.value)} />
                </div>

                {/* Categoría e Importe */}
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

                {/* Nombre comercio y NIF */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comercio / Proveedor</Label>
                    <div className="flex gap-1">
                      <Input placeholder="Nombre comercio" value={form.nombre_comercio} onChange={e => setField('nombre_comercio', e.target.value)} />
                      <VoiceInputButton onResult={txt => setField('nombre_comercio', txt)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">NIF / CIF</Label>
                    <Input placeholder="B12345678" value={form.nif_comercio} onChange={e => setField('nif_comercio', e.target.value)} />
                  </div>
                </div>

                {/* Concepto */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Concepto / Descripción</Label>
                  <div className="flex gap-1">
                    <Input placeholder="Descripción del gasto" value={form.concepto} onChange={e => setField('concepto', e.target.value)} />
                    <VoiceInputButton onResult={txt => setField('concepto', txt)} />
                  </div>
                </div>

                {/* Obra */}
                <ObraSelector
                  value={form.obra_id}
                  obraName={form.obra_name}
                  obraTipo={form.obra_tipo}
                  onChange={({ obra_id, obra_name, obra_tipo }) => setForm(f => ({ ...f, obra_id, obra_name, obra_tipo }))}
                />

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas adicionales</Label>
                  <Input placeholder="Observaciones..." value={form.notas} onChange={e => setField('notas', e.target.value)} />
                </div>
              </>
            )}
          </div>

          {paso === 'formulario' && (
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Crear Registro
              </Button>
            </DialogFooter>
          )}
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
              Ya existe un registro con el mismo día, comercio e importe:<br />
              <strong>{posibleDup?.numero_nota}</strong> — {posibleDup?.concepto}<br />
              ¿Confirmas que este gasto es diferente y no es un duplicado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPosibleDup(null); setShowDupAlert(false); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupAlert(false); doCreate(); }}>
              Sí, es un gasto diferente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}