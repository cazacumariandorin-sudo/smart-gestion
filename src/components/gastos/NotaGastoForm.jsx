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
import { Loader2, AlertTriangle, UserCheck, RefreshCw, Clock, ScanLine, CheckCircle2 } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['combustible', 'comida', 'material', 'peaje', 'parking', 'otros'];
const defaultForm = { categoria: '', concepto: '', importe: '', nif_comercio: '', nombre_comercio: '', fecha_documento: '', codigo_validacion_fiscal: '', obra_id: '', obra_name: '', obra_tipo: '', notas: '', justificacion_tardia: '' };

async function generarNumeroNota() {
  const year = new Date().getFullYear();
  try {
    const todos = await base44.entities.RegistroGasto.list('-created_date', 9999);
    const seq = todos.filter(r => new Date(r.fecha_creacion_real || r.created_date).getFullYear() === year).length + 1;
    return { numero_nota: `REG-${year}-${String(seq).padStart(4, '0')}`, numero_secuencia: seq };
  } catch {
    const ts = Date.now() % 100000;
    return { numero_nota: `REG-${year}-${ts}`, numero_secuencia: ts };
  }
}

export default function NotaGastoForm({ open, onClose, onCreated, operario, isAdmin = false, operarios = [] }) {
  const [paso, setPaso] = useState('captura');
  const [form, setForm] = useState(defaultForm);
  const [archivos, setArchivos] = useState([]);
  const [ocrRaw, setOcrRaw] = useState('');
  const [captureData, setCaptureData] = useState(null);
  const [iaNoDispo, setIaNoDispo] = useState(false);
  const [debugOcrError, setDebugOcrError] = useState('');
  const [showDupAlert, setShowDupAlert] = useState(false);
  const [posibleDup, setPosibleDup] = useState(null);
  const [operarioSeleccionado, setOperarioSeleccionado] = useState(null);
  const [showObraModal, setShowObraModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) { setPaso('captura'); setForm(defaultForm); setArchivos([]); setOcrRaw(''); setCaptureData(null); setIaNoDispo(false); setPosibleDup(null); setOperarioSeleccionado(null); setShowObraModal(false); setPendingSave(false); }
  }, [open]);

  const operarioEfectivo = (isAdmin && operarioSeleccionado) ? (operarios.find(op => op.id === operarioSeleccionado) || operario) : operario;

  const createMutation = useOptimisticMutation(
    (payload) => base44.entities.RegistroGasto.create(payload),
    'notas_gasto',
    (prev, payload) => [{ id: `optimistic-${Date.now()}`, ...payload }, ...prev],
    (data) => { toast.success(`Registro ${data?.numero_nota || ''} creado correctamente`, { description: `${data?.categoria || '—'} · ${data?.importe ? data.importe.toFixed(2) + ' €' : '—'}`, duration: 5000 }); onCreated?.(); onClose(); },
    (err) => toast.error('Error al crear: ' + err.message)
  );

  const { data: notasExistentes = [] } = useQuery({ queryKey: ['notas_gasto_check', operarioEfectivo?.id], queryFn: () => base44.entities.RegistroGasto.filter({ operario_id: operarioEfectivo?.id }), enabled: !!operarioEfectivo?.id });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const esGastoTardio = useMemo(() => { if (!form.fecha_documento) return false; return Math.floor((Date.now() - new Date(form.fecha_documento)) / 86400000) > 30; }, [form.fecha_documento]);

  const handleDone = ({ ocrDatos, ocr_raw, needs_manual, preview, archivo, cdn_url, debug_error }) => {
    if (debug_error) setDebugOcrError(debug_error);
    setCaptureData({ preview, archivo, cdn_url });
    setArchivos([{ ...archivo, url: archivo.url || cdn_url }]);
    setOcrRaw(ocr_raw || '');
    // Pre-rellenar formulario con datos IA si disponibles
    if (ocrDatos && !needs_manual) {
      if (ocrDatos.concepto) setField('concepto', ocrDatos.concepto);
      if (ocrDatos.importe) setField('importe', String(ocrDatos.importe));
      if (ocrDatos.nif_comercio) setField('nif_comercio', ocrDatos.nif_comercio);
      if (ocrDatos.nombre_comercio) setField('nombre_comercio', ocrDatos.nombre_comercio);
      if (ocrDatos.fecha_documento) setField('fecha_documento', ocrDatos.fecha_documento);
      if (ocrDatos.categoria_sugerida) setField('categoria', ocrDatos.categoria_sugerida);
      if (ocrDatos.codigo_validacion_fiscal) setField('codigo_validacion_fiscal', ocrDatos.codigo_validacion_fiscal);
    }
    setIaNoDispo(!!needs_manual);
    setPaso('formulario'); // saltar directamente al formulario, sin paso intermedio
  };

  const checkDuplicado = () => {
    if (form.codigo_validacion_fiscal) { const d = notasExistentes.find(n => n.codigo_validacion_fiscal === form.codigo_validacion_fiscal && n.estado !== 'rechazada'); if (d) return { ...d, esDuplicadoFiscal: true }; }
    if (!form.fecha_documento || !form.nombre_comercio || !form.importe) return null;
    return notasExistentes.find(n => n.fecha_documento === form.fecha_documento && n.nombre_comercio?.toLowerCase() === form.nombre_comercio?.toLowerCase() && Math.abs((n.importe || 0) - parseFloat(form.importe || 0)) < 0.01 && n.estado !== 'rechazada') || null;
  };

  const doGuardar = async (extraFields = {}) => {
    const dup = checkDuplicado();
    if (dup && !posibleDup) { setPosibleDup(dup); setShowDupAlert(true); return; }
    const { numero_nota, numero_secuencia } = await generarNumeroNota();
    const hoy = format(new Date(), 'yyyy-MM-dd');
    createMutation.mutate({ numero_nota, numero_secuencia, operario_id: operarioEfectivo.id, operario_name: operarioEfectivo.name || operarioEfectivo.full_name, categoria: form.categoria, concepto: esGastoTardio ? `Nota pendiente: ${form.concepto || 'Gasto anterior'}` : form.concepto, importe: parseFloat(form.importe), nif_comercio: form.nif_comercio, nombre_comercio: form.nombre_comercio, fecha_documento: form.fecha_documento || hoy, fecha_creacion_real: hoy, obra_id: form.obra_id || null, obra_name: form.obra_name || null, obra_tipo: form.obra_tipo || null, estado: 'borrador', archivos, ocr_raw: ocrRaw, ocr_status: ocrRaw ? 'procesado' : 'sin_ocr', codigo_validacion_fiscal: form.codigo_validacion_fiscal || null, es_gasto_tardio: esGastoTardio, justificacion_tardia: esGastoTardio ? form.justificacion_tardia : null, es_posible_duplicado: !!dup, duplicado_confirmado: !!posibleDup, ia_no_disponible: iaNoDispo, ...extraFields });
  };

  const handleSubmit = () => {
    if (!operarioEfectivo?.id) { toast.error('No se pudo identificar al operario'); return; }
    if (!form.categoria || !form.importe) { toast.error('Categoría e importe son obligatorios'); return; }
    if (esGastoTardio && !form.justificacion_tardia?.trim()) { toast.error('Justifica el retraso del gasto'); return; }
    if (!form.obra_id) { setPendingSave(true); setShowObraModal(true); return; }
    doGuardar();
  };

  const handleObraAsignada = async ({ obra_id, obra_name, obra_tipo }) => {
    setForm(f => ({ ...f, obra_id, obra_name, obra_tipo })); setShowObraModal(false); setPendingSave(false);
    if (!operarioEfectivo?.id) { toast.error('No hay operario vinculado'); return; }
    const dup = checkDuplicado(); const { numero_nota, numero_secuencia } = await generarNumeroNota(); const hoy = format(new Date(), 'yyyy-MM-dd');
    createMutation.mutate({ numero_nota, numero_secuencia, operario_id: operarioEfectivo.id, operario_name: operarioEfectivo.name || operarioEfectivo.full_name, categoria: form.categoria, concepto: esGastoTardio ? `Nota pendiente: ${form.concepto || 'Gasto anterior'}` : form.concepto, importe: parseFloat(form.importe), nif_comercio: form.nif_comercio, nombre_comercio: form.nombre_comercio, fecha_documento: form.fecha_documento || hoy, fecha_creacion_real: hoy, obra_id, obra_name, obra_tipo, estado: 'borrador', archivos, ocr_raw: ocrRaw, ocr_status: ocrRaw ? 'procesado' : 'sin_ocr', codigo_validacion_fiscal: form.codigo_validacion_fiscal || null, es_gasto_tardio: esGastoTardio, justificacion_tardia: esGastoTardio ? form.justificacion_tardia : null, es_posible_duplicado: !!dup, duplicado_confirmado: false, aviso_obra_mostrado: true, sin_obra: false, ia_no_disponible: iaNoDispo });
  };

  const handleContinuarSinObra = () => { setShowObraModal(false); setPendingSave(false); doGuardar({ sin_obra: true, sin_obra_timestamp: new Date().toISOString(), aviso_obra_mostrado: true }); };
  const titulosPaso = { captura: 'Nuevo Gasto — Foto del ticket', formulario: 'Nuevo Gasto — Datos del registro' };
  const pasos = ['captura', 'formulario'];

  return (
    <>
      <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{titulosPaso[paso] || 'Nuevo Registro de Gasto'}</span>
              {esGastoTardio && paso === 'formulario' && <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-1 rounded-full">Pendiente</span>}
            </DialogTitle>
            <div className="flex items-center gap-1 mt-1">
              {pasos.map((p, i) => (
                <div key={p} className="flex items-center gap-1">
                  <div className={cn('w-2 h-2 rounded-full transition-colors', paso === p ? 'bg-primary' : i === 0 && paso === 'formulario' ? 'bg-primary/40' : 'bg-muted')} />
                  {i < 1 && <div className={cn('h-px w-8 transition-colors', paso === 'formulario' ? 'bg-primary/40' : 'bg-muted')} />}
                </div>
              ))}
              <span className="ml-2 text-[10px] text-muted-foreground">
                {paso === 'captura' ? 'Paso 1 de 2 — Foto del ticket' : 'Paso 2 de 2 — Datos del gasto'}
              </span>
            </div>
          </DialogHeader>

          {paso === 'captura' && <TicketCapture onDone={handleDone} onSkip={() => setPaso('formulario')} />}

          {paso === 'formulario' && (
            <div className="space-y-4 py-2">
              {isAdmin && operarios.length > 0 && (
                <div className="space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Label className="text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300"><UserCheck className="w-3.5 h-3.5" /> Asignar a operario</Label>
                  <MobileSelect value={operarioSeleccionado || ''} onValueChange={v => setOperarioSeleccionado(v || null)} placeholder={`${operario?.name || 'Operario propio'} (por defecto)`}>
                    {operarios.filter(op => op.active !== false).map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                  </MobileSelect>
                </div>
              )}
              {captureData?.preview ? (
                <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-xl border">
                  <img src={captureData.preview} alt="ticket" className="w-12 h-12 object-cover rounded-lg border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{captureData.archivo?.nombre || 'Ticket'}</p>
                    <p className="text-[10px] text-muted-foreground">{ocrRaw ? '✓ Datos extraídos por OCR+IA' : 'Sin extracción automática'}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setPaso('captura')} title="Volver a capturar"><RefreshCw className="w-3.5 h-3.5" /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setPaso('captura')}><ScanLine className="w-3.5 h-3.5" /> Añadir ticket / factura</Button>
              )}
              {iaNoDispo && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                        Introduce los datos manualmente
                      </p>
                      {ocrRaw && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-amber-600 cursor-pointer">Ver texto extraído del ticket</summary>
                          <pre className="text-[10px] text-muted-foreground mt-1 bg-background/60 rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap">{ocrRaw}</pre>
                        </details>
                      )}
                      {debugOcrError && (
                        <details className="mt-1" open>
                          <summary className="text-[10px] text-red-500 cursor-pointer">⚠ Error OCR (diagnóstico)</summary>
                          <pre className="text-[9px] text-red-600 mt-1 bg-red-50 dark:bg-red-950/20 rounded p-1.5 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{debugOcrError}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-1.5"><Label className="text-xs">Fecha del documento</Label><Input type="date" value={form.fecha_documento} onChange={e => setField('fecha_documento', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Categoría *</Label><MobileSelect value={form.categoria} onValueChange={v => setField('categoria', v)} placeholder="Categoría">{CATEGORIAS.map(c => <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>)}</MobileSelect></div>
                <div className="space-y-1.5"><Label className="text-xs">Importe (€) *</Label><Input type="number" step="0.01" placeholder="0.00" value={form.importe} onChange={e => setField('importe', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Comercio / Proveedor</Label><div className="flex gap-1"><Input placeholder="Nombre" value={form.nombre_comercio} onChange={e => setField('nombre_comercio', e.target.value)} /><VoiceInputButton onResult={t => setField('nombre_comercio', t)} /></div></div>
                <div className="space-y-1.5"><Label className="text-xs">NIF / CIF</Label><Input placeholder="B12345678" value={form.nif_comercio} onChange={e => setField('nif_comercio', e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Concepto / Descripción</Label><div className="flex gap-1"><Input placeholder="Descripción del gasto" value={form.concepto} onChange={e => setField('concepto', e.target.value)} /><VoiceInputButton onResult={t => setField('concepto', t)} /></div></div>
              <ObraSelector value={form.obra_id} obraName={form.obra_name} obraTipo={form.obra_tipo} onChange={({ obra_id, obra_name, obra_tipo }) => setForm(f => ({ ...f, obra_id, obra_name, obra_tipo }))} />
              <div className="space-y-1.5"><Label className="text-xs">Notas adicionales</Label><Input placeholder="Observaciones…" value={form.notas} onChange={e => setField('notas', e.target.value)} /></div>
              {esGastoTardio && (
                <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Label className="text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold"><Clock className="w-3.5 h-3.5" /> Gasto con más de 30 días</Label>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1.5">Se registrará como pendiente. Justifica el retraso.</p>
                  <Input placeholder="Ej: Olvidé subir el ticket…" value={form.justificacion_tardia} onChange={e => setField('justificacion_tardia', e.target.value)} className="border-amber-300 focus:border-amber-500" />
                </div>
              )}
            </div>
          )}

          {paso === 'formulario' && (
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {createMutation.isPending ? 'Guardando…' : 'Guardar Registro'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <ObraObligatoriaModal open={showObraModal} onAsignarObra={handleObraAsignada} onContinuarSinObra={handleContinuarSinObra} />
      <AlertDialog open={showDupAlert} onOpenChange={setShowDupAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />{posibleDup?.esDuplicadoFiscal ? 'Duplicado exacto (QR)' : 'Posible duplicado'}</AlertDialogTitle>
            <AlertDialogDescription>{posibleDup?.esDuplicadoFiscal ? <>Mismo código QR que <strong>{posibleDup?.numero_nota}</strong>. ¿Seguro que no es duplicado?</> : <>Ya existe <strong>{posibleDup?.numero_nota}</strong> con mismo día, comercio e importe. ¿Es un gasto diferente?</>}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPosibleDup(null); setShowDupAlert(false); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupAlert(false); handleSubmit(); }}>Sí, continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}