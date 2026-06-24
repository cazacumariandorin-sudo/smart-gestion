import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ObraSelector from './ObraSelector';
import TicketCapture from './TicketCapture';
import ObraObligatoriaModal from './ObraObligatoriaModal';
import { Loader2, AlertTriangle, FileCheck, UserCheck, Image, RefreshCw, Clock } from 'lucide-react';
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
  codigo_validacion_fiscal: '',
  obra_id: '',
  obra_name: '',
  obra_tipo: '',
  notas: '',
  justificacion_tardia: '',
};

/** Genera un número de registro real consultando cuántos existen este año */
async function generarNumeroNota() {
  const now = new Date();
  const year = now.getFullYear();
  try {
    const todos = await base44.entities.RegistroGasto.list('-created_date', 9999);
    const esteAnio = todos.filter(r => {
      const fecha = r.fecha_creacion_real || r.created_date;
      return fecha && new Date(fecha).getFullYear() === year;
    });
    const seq = esteAnio.length + 1;
    const numero_nota = `REG-${year}-${String(seq).padStart(4, '0')}`;
    return { numero_nota, numero_secuencia: seq };
  } catch {
    // Fallback: usar timestamp como secuencia única
    const ts = Date.now() % 100000;
    return { numero_nota: `REG-${year}-${ts}`, numero_secuencia: ts };
  }
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
  const [analizando, setAnalizando] = useState(false);
  const { user } = useAuth();

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

  // Autoload operario for operario/control_horario roles
  useEffect(() => {
    if (!user?.email) return;
    if (user.role !== 'operario' && user.role !== 'control_horario') return;
    
    base44.entities.Operario
      .filter({ user_email: user.email })
      .then(operarios => {
        if (operarios.length > 0) {
          const op = operarios[0];
          if (!operario) {
            // Si no hay operario prop (modo admin), usar el encontrado
            // Esto es solo para usuarios con rol operario que están creando gastos personales
          }
        } else {
          console.warn('No Operario record linked to user:', user.email);
        }
      })
      .catch(() => {});
  }, [user?.email, user?.role]);

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

  // Calcular si es gasto tardío (más de 30 días de antigüedad)
  const esGastoTardio = useMemo(() => {
    if (!form.fecha_documento) return false;
    const hoy = new Date();
    const fechaTicket = new Date(form.fecha_documento);
    const diferenciaDias = Math.floor((hoy - fechaTicket) / (1000 * 60 * 60 * 24));
    return diferenciaDias > 30;
  }, [form.fecha_documento]);

  const handleTicketDone = async ({ file_url, archivo, ocrDatos }) => {
    setArchivos([archivo]);
    if (ocrDatos.ocr_raw) setOcrRaw(ocrDatos.ocr_raw);
    if (ocrDatos.concepto) setField('concepto', ocrDatos.concepto);
    if (ocrDatos.importe) setField('importe', String(ocrDatos.importe));
    if (ocrDatos.nif_comercio) setField('nif_comercio', ocrDatos.nif_comercio);
    if (ocrDatos.nombre_comercio) setField('nombre_comercio', ocrDatos.nombre_comercio);
    if (ocrDatos.fecha_documento) setField('fecha_documento', ocrDatos.fecha_documento);
    if (ocrDatos.categoria_sugerida) setField('categoria', ocrDatos.categoria_sugerida);
    if (ocrDatos.codigo_validacion_fiscal) setField('codigo_validacion_fiscal', ocrDatos.codigo_validacion_fiscal);
    setTicketPreview(file_url);
    setPaso('formulario');

    // OCR mejorado via backend
    setAnalizando(true);
    try {
      const res = await base44.functions.invoke('procesarOcrNota', { file_url });
      if (res?.data) {
        setForm(prev => ({
          ...prev,
          concepto: res.data.concepto || prev.concepto,
          importe: res.data.importe ? String(res.data.importe) : prev.importe,
          nombre_comercio: res.data.nombre_comercio || prev.nombre_comercio,
          nif_comercio: res.data.nif_comercio || prev.nif_comercio,
          fecha_documento: res.data.fecha || prev.fecha_documento,
          codigo_validacion_fiscal: res.data.codigo_qr || prev.codigo_validacion_fiscal,
        }));
        toast.success('Datos extraídos del ticket — revisa antes de guardar');
      }
    } catch {
      toast.warning('No se pudieron extraer datos automáticamente del ticket');
    } finally {
      setAnalizando(false);
    }
  };

  const checkDuplicado = () => {
    // Prioridad 1: Si hay código QR/fiscal, buscar duplicado exacto por ese código
    if (form.codigo_validacion_fiscal) {
      const dupPorQr = notasExistentes.find(n =>
        n.codigo_validacion_fiscal === form.codigo_validacion_fiscal &&
        n.estado !== 'rechazada'
      );
      if (dupPorQr) return { ...dupPorQr, esDuplicadoFiscal: true };
    }
    
    // Prioridad 2: Firma compuesta tradicional (NIF + Importe + Fecha + 1 min)
    if (!form.fecha_documento || !form.nombre_comercio || !form.importe) return null;
    return notasExistentes.find(n =>
      n.fecha_documento === form.fecha_documento &&
      n.nombre_comercio?.toLowerCase() === form.nombre_comercio?.toLowerCase() &&
      Math.abs((n.importe || 0) - parseFloat(form.importe || 0)) < 0.01 &&
      n.estado !== 'rechazada'
    ) || null;
  };

  const doGuardar = async (extraFields = {}) => {
    const dup = checkDuplicado();
    if (dup && !posibleDup) {
      setPosibleDup(dup);
      setShowDupAlert(true);
      return;
    }

    const { numero_nota, numero_secuencia } = await generarNumeroNota();
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const conceptoFinal = esGastoTardio ? `Nota pendiente: ${form.concepto || 'Gasto del mes anterior'}` : form.concepto;

    createMutation.mutate({
      numero_nota,
      numero_secuencia,
      operario_id: operarioEfectivo.id,
      operario_name: operarioEfectivo.name || operarioEfectivo.full_name,
      categoria: form.categoria,
      concepto: conceptoFinal,
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
      codigo_validacion_fiscal: form.codigo_validacion_fiscal || null,
      es_gasto_tardio: esGastoTardio,
      justificacion_tardia: esGastoTardio ? form.justificacion_tardia : null,
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
    if (esGastoTardio && !form.justificacion_tardia?.trim()) {
      toast.error('Debes justificar por qué este gasto se registra con retraso');
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

  const handleObraAsignada = async ({ obra_id, obra_name, obra_tipo }) => {
    setForm(f => ({ ...f, obra_id, obra_name, obra_tipo }));
    setShowObraModal(false);
    setPendingSave(false);
    
    // Validar que tenemos operario_id
    if (!operarioEfectivo?.id) {
      toast.error('No hay operario vinculado a tu usuario. Contacta con administración.');
      return;
    }
    
    // Validar justificación si es tardío
    if (esGastoTardio && !form.justificacion_tardia?.trim()) {
      toast.error('Debes justificar por qué este gasto se registra con retraso');
      return;
    }
    
    // Guardar con la obra asignada directamente
    const dup = checkDuplicado();
    const { numero_nota, numero_secuencia } = await generarNumeroNota();
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const conceptoFinal = esGastoTardio ? `Nota pendiente: ${form.concepto || 'Gasto del mes anterior'}` : form.concepto;
    createMutation.mutate({
      numero_nota,
      numero_secuencia,
      operario_id: operarioEfectivo.id,
      operario_name: operarioEfectivo.name || operarioEfectivo.full_name,
      categoria: form.categoria,
      concepto: conceptoFinal,
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
      codigo_validacion_fiscal: form.codigo_validacion_fiscal || null,
      es_gasto_tardio: esGastoTardio,
      justificacion_tardia: esGastoTardio ? form.justificacion_tardia : null,
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
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paso === 'captura' ? 'Nuevo Registro de Gasto — Ticket' : 'Nuevo Registro de Gasto'}
              {esGastoTardio && (
                <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-1 rounded-full">
                  Pendiente de contabilizar
                </span>
              )}
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
            <div className="space-y-4 py-2 relative">
              {analizando && (
                <div className="absolute inset-0 z-10 bg-background/80 flex flex-col items-center justify-center gap-2 rounded-lg">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">Analizando ticket...</p>
                </div>
              )}
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

              {/* Justificación gasto tardío */}
              {esGastoTardio && (
                <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Label className="text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                    <Clock className="w-3.5 h-3.5" /> Gasto con más de 30 días
                  </Label>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    Este gasto se registrará como "pendiente de contabilizar". Explica brevemente el motivo del retraso.
                  </p>
                  <Input
                    placeholder="Ej: Olvidé subir el ticket del mes pasado..."
                    value={form.justificacion_tardia}
                    onChange={e => setField('justificacion_tardia', e.target.value)}
                    className="border-amber-300 focus:border-amber-500"
                    required
                  />
                </div>
              )}
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
              <AlertTriangle className="w-5 h-5 text-amber-500" /> 
              {posibleDup?.esDuplicadoFiscal ? 'Duplicado exacto detectado (QR)' : 'Posible duplicado detectado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {posibleDup?.esDuplicadoFiscal ? (
                <>
                  Este ticket tiene el <strong>mismo código de validación fiscal (QR)</strong> que un registro existente:<br />
                  <strong>{posibleDup?.numero_nota}</strong> — {posibleDup?.concepto}<br />
                  <span className="text-xs text-red-600 mt-1 block">⚠️ Los códigos QR son únicos por transacción. ¿Estás seguro de que no es un duplicado?</span>
                </>
              ) : (
                <>
                  Ya existe un registro con el mismo día, comercio e importe:<br />
                  <strong>{posibleDup?.numero_nota}</strong> — {posibleDup?.concepto}<br />
                  ¿Confirmas que este gasto es diferente?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPosibleDup(null); setShowDupAlert(false); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupAlert(false); handleSubmit(); }}>
              Sí, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}