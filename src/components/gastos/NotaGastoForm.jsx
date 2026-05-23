import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ObraSelector from './ObraSelector';
import TicketCapture from './TicketCapture';
import ObraObligatoriaModal from './ObraObligatoriaModal';
import { Loader2, AlertTriangle, FileCheck, UserCheck, Image, RefreshCw } from 'lucide-react';
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

/** Genera un número de nota en el frontend: NOT-YYYY-XX-MM */
function generarNumeroNota() {
  const now = new Date();
  const year = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const sec = String(Math.floor(Math.random() * 900) + 100); // 3 dígitos aleatorios como secuencia temporal
  return { numero_nota: `REG-${year}-${sec}-${mm}`, numero_secuencia: parseInt(sec) };
}

export default function NotaGastoForm({ open, onClose, onCreated, operario, isAdmin = false, operarios = [] }) {
  const [paso, setPaso] = useState('captura'); // captura | formulario
  const [form, setForm] = useState(defaultForm);
  const [archivos, setArchivos] = useState([]);
  const [ocrRaw, setOcrRaw] = useState('');
  const [ticketPreview, setTicketPreview] = useState(null);
  const [showDupAlert, setShowDupAlert] = useState(false);
  const [posibleDup, setPosibleDup] = useState(null);
  const [operarioSeleccionado, setOperarioSeleccionado] = useState(null);
  const [showObraModal, setShowObraModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (open) {
      setPaso('captura');
      setForm(defaultForm);
      setArchivos([]);
      setOcrRaw('');
      setTicketPreview(null);
      setPosibleDup(null);
      setOperarioSeleccionado(null);
      setShowObraModal(false);
      setPendingSave(false);
    }
  }, [open]);

  const operarioEfectivo = (isAdmin && operarioSeleccionado)
    ? operarios.find(op => op.id === operarioSeleccionado) || operario
    : operario;

  const createMutation = useOptimisticMutation(
    (payload) => base44.entities.RegistroGasto.create(payload),
    'notas_gasto',
    (prev, payload) => [{ id: `optimistic-${Date.now()}`, ...payload }, ...prev],
    (data) => {
      toast.success(`Registro ${data?.numero_nota || ''} creado`);
      onCreated?.();
      onClose();
    },
    (err) => toast.error('Error al crear registro: ' + err.message)
  );

  const { data: notasExistentes = [] } = useQuery({
    queryKey: ['notas_gasto_check', operarioEfectivo?.id],
    queryFn: () => base44.entities.RegistroGasto.filter({ operario_id: operarioEfectivo?.id }),
    enabled: !!operarioEfectivo?.id,
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTicketDone = ({ file_url, archivo, ocrDatos }) => {
    setArchivos([archivo]);
    if (ocrDatos.ocr_raw) setOcrRaw(ocrDatos.ocr_raw);
    if (ocrDatos.concepto) setField('concepto', ocrDatos.concepto);
    if (ocrDatos.importe) setField('importe', String(ocrDatos.importe));
    if (ocrDatos.nif_comercio) setField('nif_comercio', ocrDatos.nif_comercio);
    if (ocrDatos.nombre_comercio) setField('nombre_comercio', ocrDatos.nombre_comercio);
    if (ocrDatos.fecha_documento) setField('fecha_documento', ocrDatos.fecha_documento);
    if (ocrDatos.categoria_sugerida) setField('categoria', ocrDatos.categoria_sugerida);
    setTicketPreview(file_url);
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

  const doGuardar = (extraFields = {}) => {
    const dup = checkDuplicado();
    if (dup && !posibleDup) {
      setPosibleDup(dup);
      setShowDupAlert(true);
      return;
    }

    const { numero_nota, numero_secuencia } = generarNumeroNota();
    const hoy = format(new Date(), 'yyyy-MM-dd');

    createMutation.mutate({
      numero_nota,
      numero_secuencia,
      operario_id: operarioEfectivo.id,
      operario_name: operarioEfectivo.name || operarioEfectivo.full_name,
      categoria: form.categoria,
      concepto: form.concepto,
      importe: parseFloat(form.importe),
      nif_comercio: form.nif_comercio,
      nombre_comercio: form.nombre_comercio,
      fecha_documento: form.fecha_documento || hoy,
      fecha_creacion_real: hoy,
      obra_id: form.obra_id || null,
      obra_name: form.obra_name || null,
      obra_tipo: form.obra_tipo || null,
      estado: 'pendiente',
      archivos,
      ocr_raw: ocrRaw,
      ocr_status: ocrRaw ? 'procesado' : 'pendiente',
      es_gasto_tardio: false,
      es_posible_duplicado: !!dup,
      duplicado_confirmado: !!posibleDup,
      ...extraFields,
    });
  };

  const handleSubmit = () => {
    if (!operarioEfectivo?.id) {
      toast.error('No se pudo identificar al operario. Asegúrate de tener un perfil vinculado.');
      return;
    }
    if (!form.categoria || !form.importe) {
      toast.error('Categoría e importe son obligatorios');
      return;
    }

    // Si no hay obra asignada, mostrar modal bloqueante
    if (!form.obra_id) {
      setPendingSave(true);
      setShowObraModal(true);
      return;
    }

    doGuardar();
  };

  const handleObraAsignada = ({ obra_id, obra_name, obra_tipo }) => {
    setForm(f => ({ ...f, obra_id, obra_name, obra_tipo }));
    setShowObraModal(false);
    setPendingSave(false);
    
    // Validar que tenemos operario_id
    if (!operarioEfectivo?.id) {
      toast.error('No hay operario vinculado a tu usuario. Contacta con administración.');
      return;
    }
    
    // Guardar con la obra asignada directamente
    const dup = checkDuplicado();
    const { numero_nota, numero_secuencia } = generarNumeroNota();
    const hoy = format(new Date(), 'yyyy-MM-dd');
    createMutation.mutate({
      numero_nota,
      numero_secuencia,
      operario_id: operarioEfectivo.id,
      operario_name: operarioEfectivo.name || operarioEfectivo.full_name,
      categoria: form.categoria,
      concepto: form.concepto,
      importe: parseFloat(form.importe),
      nif_comercio: form.nif_comercio,
      nombre_comercio: form.nombre_comercio,
      fecha_documento: form.fecha_documento || hoy,
      fecha_creacion_real: hoy,
      obra_id,
      obra_name,
      obra_tipo,
      estado: 'pendiente',
      archivos,
      ocr_raw: ocrRaw,
      ocr_status: ocrRaw ? 'procesado' : 'pendiente',
      es_gasto_tardio: false,
      es_posible_duplicado: !!dup,
      duplicado_confirmado: false,
      aviso_obra_mostrado: true,
      sin_obra: false,
    });
  };

  const handleContinuarSinObra = () => {
    setShowObraModal(false);
    setPendingSave(false);
    doGuardar({
      sin_obra: true,
      sin_obra_timestamp: new Date().toISOString(),
      aviso_obra_mostrado: true,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paso === 'captura' ? 'Nuevo Registro de Gasto — Ticket' : 'Nuevo Registro de Gasto'}
            </DialogTitle>
          </DialogHeader>

          {/* PASO 1: CAPTURA */}
          {paso === 'captura' && (
            <TicketCapture
              onDone={handleTicketDone}
              onSkip={() => setPaso('formulario')}
            />
          )}

          {/* PASO 2: FORMULARIO */}
          {paso === 'formulario' && (
            <div className="space-y-4 py-2">
              {/* Selector de operario — solo admins */}
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
                    <p className="text-xs text-blue-600">✓ En nombre de: <strong>{operarioEfectivo?.name}</strong></p>
                  )}
                </div>
              )}

              {/* Thumbnail ticket + opción de repetir */}
              {ticketPreview ? (
                <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg border">
                  <img src={ticketPreview} alt="ticket" className="w-14 h-14 object-cover rounded-lg border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{archivos[0]?.nombre || 'Ticket'}</p>
                    {ocrRaw && <p className="text-xs text-green-600">✓ Datos extraídos automáticamente</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setPaso('captura')}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setPaso('captura')}>
                  <Image className="w-3.5 h-3.5" /> Añadir imagen del ticket
                </Button>
              )}

              {archivos.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {archivos.slice(1).map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
                      <FileCheck className="w-3 h-3" /> {a.nombre}
                    </span>
                  ))}
                </div>
              )}

              {/* Fecha documento */}
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha del documento</Label>
                <Input type="date" value={form.fecha_documento} onChange={e => setField('fecha_documento', e.target.value)} />
              </div>

              {/* Categoría + Importe */}
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

              {/* Comercio + NIF */}
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
            </div>
          )}

          {paso === 'formulario' && (
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Crear Registro
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ObraObligatoriaModal
        open={showObraModal}
        onAsignarObra={handleObraAsignada}
        onContinuarSinObra={handleContinuarSinObra}
      />

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
              ¿Confirmas que este gasto es diferente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPosibleDup(null); setShowDupAlert(false); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupAlert(false); handleSubmit(); }}>
              Sí, es un gasto diferente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}