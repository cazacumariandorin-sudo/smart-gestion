
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AutoCorrectTextarea from '@/components/ui/AutoCorrectTextarea';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card } from '@/components/ui/card';
import { Save, Loader2, Camera, Upload, X, ImageIcon } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { toast } from 'sonner';
import WorkerFields from '@/components/workorders/WorkerFields';
import MaterialFields from '@/components/workorders/MaterialFields';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import DesplazamientoFields from '@/components/partes/DesplazamientoFields';
import PageHeader from '@/components/layout/PageHeader';
import { subirImagen } from '@/lib/uploadPhoto';
import { revisarParte } from '@/lib/ortografiaPartes';
import { asignarNumeroParte } from '@/lib/numeroParte';
import {
  hoyLocal, limpiarParte, validarFilas, validarDesplazamiento, calcularFirmaStatus, mensajeErrorGuardado,
  leerBorrador, guardarBorrador, borrarBorrador, comprimirImagen,
} from '@/lib/workOrderUtils';

const formVacio = () => ({
  date: hoyLocal(),
  client_id: '',
  client_name: '',
  project: '',
  obra_id: '',
  description: '',
  status: 'pendiente',
  hora_inicio: '',
  hora_fin: '',
  workers: [],
  materials: [],
  notes: '',
  firma_operario: '',
  firma_cliente: '',
  vehiculo_id: '',
  vehiculo_matricula: '',
  desplazamiento_tipo: '',
  desplazamiento_valor: '',
  desplazamiento_importe_eur: '',
  desplazamiento_modalidad: 'km',
  desplazamiento_concepto: '',
});

export default function CreateWorkOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
  });

  const [recuperado] = useState(() => !!leerBorrador());
  const [form, setForm] = useState(() => ({ ...formVacio(), ...(leerBorrador() || {}) }));

  const [photos, setPhotos] = useState([]); // fotos ya subidas, pendientes de vincular al parte
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [revisando, setRevisando] = useState(false);

  // Borrador local: si falla la red o se cierra la pestaña no se pierde el trabajo
  useEffect(() => {
    const t = setTimeout(() => guardarBorrador(form), 500);
    return () => clearTimeout(t);
  }, [form]);

  useEffect(() => {
    if (recuperado) {
      toast.info('Se ha recuperado un borrador sin guardar', {
        duration: 8000,
        action: { label: 'Descartar', onClick: () => { borrarBorrador(); setForm(formVacio()); } },
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (data) => {
      const order = await base44.entities.WorkOrder.create(data);
      // Las fotos NO deben invalidar el parte ya creado (evita duplicados al reintentar)
      let fotosFallidas = 0;
      for (const photoUrl of photos) {
        try {
          await base44.entities.WorkPhoto.create({
            work_order_id: order.id,
            client_id: data.client_id,
            client_name: data.client_name,
            project: data.project,
            date: data.date,
            photo_url: photoUrl,
            caption: '',
          });
        } catch (e) {
          console.error('[WorkOrder] No se pudo vincular una foto', e);
          fotosFallidas++;
        }
      }
      // Número único del parte (si falla, el parte ya está guardado y se podrá asignar después)
      let numero = '';
      try { numero = await asignarNumeroParte(order.id); } catch (e) { console.error('[WorkOrder] No se pudo asignar el número', e); }
      return { order, fotosFallidas, numero };
    },
    onSuccess: ({ fotosFallidas, numero }) => {
      borrarBorrador();
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      if (fotosFallidas) toast.warning(`Parte creado, pero ${fotosFallidas} foto(s) no se pudieron vincular. Añádelas desde el detalle del parte.`, { duration: 8000 });
      else if (numero) toast.success(`✅ Parte ${numero} creado correctamente`, { duration: 6000 });
      else toast.warning('Parte creado, pero el número no se pudo asignar ahora. Se asignará desde el detalle del parte.', { duration: 8000 });
      navigate('/work-orders');
    },
    onError: (err) => {
      console.error('[WorkOrder] Error al crear', err);
      toast.error(mensajeErrorGuardado(err), { duration: 9000 });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    enviarParte().catch((err) => {
      console.error('[WorkOrder] Error preparando el guardado', err);
      setRevisando(false);
      toast.error(`No se pudo guardar el parte: ${err?.message || 'error inesperado'}`, { duration: 9000 });
    });
  };

  const enviarParte = async () => {
    if (mutation.isPending || revisando) return;
    if (uploadingPhotos) { toast.warning('Espera a que terminen de subirse las fotos'); return; }

    const errDesp = validarDesplazamiento(form);
    if (errDesp) { toast.error(errDesp, { duration: 7000 }); return; }

    const datos = limpiarParte(form);
    if (!datos.date) { toast.error('Indica la fecha del parte'); return; }
    if (!datos.client_id) { toast.error('Selecciona un cliente'); return; }
    if (!datos.project) { toast.error('Selecciona o escribe la obra'); return; }

    const filas = validarFilas(datos.workers, datos.materials);
    if (!filas.ok) { toast.error(filas.error); return; }

    // Revisión ortográfica ANTES de guardar (si la IA falla o tarda, se guarda igualmente)
    let datosFinal = { ...datos, workers: filas.workers, materials: filas.materials };
    setRevisando(true);
    try {
      const rev = await revisarParte(datosFinal, { timeoutMs: 12000 });
      if (!rev.ok) {
        toast.info('No se pudo revisar la ortografía (conexión lenta). El parte se guarda tal cual; puedes revisarlo después con «Revisión ortográfica».', { duration: 7000 });
      } else if (rev.cambios.length) {
        datosFinal = { ...datosFinal, ...rev.patch };
        setForm(prev => ({ ...prev, ...rev.patch }));
        toast.success(`Ortografía corregida en ${rev.cambios.length} campo(s)`);
      }
    } finally {
      setRevisando(false);
    }

    const ahora = new Date().toISOString();
    mutation.mutate({
      ...datosFinal,
      total_hours: filas.workers.reduce((sum, w) => sum + (Number(w.hours) || 0), 0),
      firma_status: calcularFirmaStatus('sin_firmar', datos.firma_operario, datos.firma_cliente),
      ...(datos.firma_operario ? { firma_operario_fecha: ahora } : {}),
      ...(datos.firma_cliente ? { firma_cliente_fecha: ahora } : {}),
    });
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Obras filtradas por el cliente seleccionado (vínculo cliente→obra)
  const obrasFiltradas = form.client_id
    ? obras.filter(o => o.client_id === form.client_id)
    : obras;

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => {
      const siguiente = { ...prev, client_id: clientId, client_name: client?.name || '' };
      // Si la obra seleccionada no pertenece al cliente, limpiarla (salvo texto manual)
      const obraSigue = obras.find(o => o.id === prev.obra_id && o.client_id === clientId);
      if (!obraSigue) {
        siguiente.obra_id = '';
        // Limpiar project si era una obra de la lista (no manual)
        if (obras.find(o => o.name === prev.project)) siguiente.project = '';
      }
      return siguiente;
    });
  };

  // Al seleccionar una obra, autocompletar cliente + obra_id (vínculo obra→cliente)
  const handleObraChange = (obraName) => {
    if (obraName === '__manual__') {
      setForm(prev => ({ ...prev, obra_id: '', project: '__manual__' }));
      return;
    }
    const obra = obras.find(o => o.name === obraName);
    if (obra) {
      setForm(prev => ({
        ...prev,
        obra_id: obra.id,
        project: obra.name,
        client_id: obra.client_id || prev.client_id,
        client_name: obra.client_name || prev.client_name,
      }));
    } else {
      setForm(prev => ({ ...prev, obra_id: '', project: obraName }));
    }
  };

  const handlePhotoFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingPhotos(true);
    try {
      for (const original of files) {
        try {
          const file = await comprimirImagen(original);
          const { file_url } = await subirImagen(file);
          setPhotos(p => [...p, file_url]);
        } catch (err) {
          console.error('[WorkOrder] Error subiendo foto', err);
          toast.error(`No se pudo subir "${original.name}". Revisa la conexión e inténtalo de nuevo.`);
        }
      }
    } finally {
      setUploadingPhotos(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (url) => setPhotos(p => p.filter(u => u !== url));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Nuevo Parte de Trabajo"
        subtitle="Completa los datos del parte"
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Info general */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-sm">Información General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <MobileSelect value={form.status} onValueChange={(v) => updateField('status', v)} placeholder="Estado">
                <MobileSelectItem value="pendiente">Pendiente</MobileSelectItem>
                <MobileSelectItem value="en_curso">En curso</MobileSelectItem>
                <MobileSelectItem value="completado">Completado</MobileSelectItem>
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente *</Label>
              <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Obra * {form.client_id && obrasFiltradas.length === 0 && <span className="text-muted-foreground">(sin obras para este cliente)</span>}</Label>
              <MobileSelect value={form.project} onValueChange={handleObraChange} placeholder={form.client_id ? "Solo obras del cliente..." : "Seleccionar obra..."}>
                {obrasFiltradas.map(o => <MobileSelectItem key={o.id} value={o.name}>{o.name}</MobileSelectItem>)}
                <MobileSelectItem value="__manual__">— Escribir manualmente —</MobileSelectItem>
              </MobileSelect>
              {(form.project === '__manual__' || (!obras.find(o => o.name === form.project) && form.project && form.project !== '__manual__')) && (
                <Input placeholder="Nombre de la obra" value={form.project === '__manual__' ? '' : form.project} onChange={e => updateField('project', e.target.value)} className="mt-1" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora inicio</Label>
              <Input type="time" value={form.hora_inicio} onChange={e => updateField('hora_inicio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora fin</Label>
              <Input type="time" value={form.hora_fin} onChange={e => updateField('hora_fin', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <div className="flex gap-1 items-start">
              <AutoCorrectTextarea placeholder="Descripción del trabajo realizado..." value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
              <VoiceInputButton onResult={txt => updateField('description', form.description ? form.description + ' ' + txt : txt)} />
            </div>
          </div>
        </Card>

        {/* Operarios */}
        <Card className="p-5">
          <WorkerFields workers={form.workers} onChange={(w) => updateField('workers', w)} />
        </Card>

        {/* Materiales */}
        <Card className="p-5">
          <MaterialFields materials={form.materials} onChange={(m) => updateField('materials', m)} />
        </Card>

        {/* Vehículo / Desplazamiento (opcional) */}
        <DesplazamientoFields
          value={{
            vehiculo_id: form.vehiculo_id,
            vehiculo_matricula: form.vehiculo_matricula,
            desplazamiento_tipo: form.desplazamiento_tipo,
            desplazamiento_valor: form.desplazamiento_valor,
            desplazamiento_importe_eur: form.desplazamiento_importe_eur,
            desplazamiento_modalidad: form.desplazamiento_modalidad,
            desplazamiento_concepto: form.desplazamiento_concepto,
          }}
          onChange={(patch) => setForm(prev => ({ ...prev, ...patch }))}
          allowPactado
        />

        {/* Fotos */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Fotos ({photos.length})
            </Label>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploadingPhotos}>
              {uploadingPhotos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploadingPhotos ? 'Subiendo...' : 'Subir fotos'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoFiles(e.target.files)} />
          </div>
          {photos.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Haz clic o arrastra fotos aquí</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((url) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={url} alt="foto" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(url)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => fileRef.current?.click()}>
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          )}
        </Card>

        {/* Firmas */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-sm">Firmas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignatureCanvas label="Firma del Operario" value={form.firma_operario} onChange={v => updateField('firma_operario', v)} />
            <SignatureCanvas label="Firma del Cliente" value={form.firma_cliente} onChange={v => updateField('firma_cliente', v)} />
          </div>
        </Card>

        {/* Observaciones */}
        <Card className="p-5 space-y-3">
          <Label className="text-sm font-semibold">Observaciones</Label>
          <div className="flex gap-1 items-start">
            <AutoCorrectTextarea placeholder="Notas adicionales..." value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
            <VoiceInputButton onResult={txt => updateField('notes', form.notes ? form.notes + ' ' + txt : txt)} />
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending || uploadingPhotos || revisando} className="gap-2 min-w-32">
            {(mutation.isPending || revisando) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {revisando ? 'Revisando ortografía…' : mutation.isPending ? 'Guardando…' : 'Guardar Parte'}
          </Button>
        </div>
      </form>
    </div>
  );
}
