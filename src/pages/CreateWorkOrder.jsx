import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Save, Loader2, Camera, Upload, X, ImageIcon } from 'lucide-react';
import WorkerFields from '@/components/workorders/WorkerFields';
import MaterialFields from '@/components/workorders/MaterialFields';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import PageHeader from '@/components/layout/PageHeader';

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

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    client_name: '',
    project: '',
    description: '',
    status: 'pendiente',
    hora_inicio: '',
    hora_fin: '',
    workers: [],
    materials: [],
    notes: '',
    firma_operario: '',
    firma_cliente: '',
  });

  const [photos, setPhotos] = useState([]); // pending photos before order is created
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const order = await base44.entities.WorkOrder.create(data);
      // Save pending photos now that we have the order id
      for (const photoUrl of photos) {
        await base44.entities.WorkPhoto.create({
          work_order_id: order.id,
          client_id: data.client_id,
          client_name: data.client_name,
          project: data.project,
          date: data.date,
          photo_url: photoUrl,
          caption: '',
        });
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      navigate('/work-orders');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalHours = form.workers.reduce((sum, w) => sum + (w.hours || 0), 0);
    mutation.mutate({ ...form, total_hours: totalHours });
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => ({ ...prev, client_id: clientId, client_name: client?.name || '' }));
  };

  const handlePhotoFiles = async (files) => {
    setUploadingPhotos(true);
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(p => [...p, file_url]);
    }
    setUploadingPhotos(false);
  };

  const removePhoto = (url) => setPhotos(p => p.filter(u => u !== url));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Nuevo Parte de Trabajo"
        subtitle="Completa los datos del parte"
      />
      <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Info general */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-sm">Información General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v) => updateField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_curso">En curso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente *</Label>
              <Select value={form.client_id} onValueChange={handleClientChange} required>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Obra *</Label>
              <Select value={form.project} onValueChange={v => updateField('project', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar obra..." /></SelectTrigger>
                <SelectContent>
                  {obras.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                  <SelectItem value="__manual__">— Escribir manualmente —</SelectItem>
                </SelectContent>
              </Select>
              {(form.project === '__manual__' || (!obras.find(o => o.name === form.project) && form.project)) && (
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
            <Textarea placeholder="Descripción del trabajo realizado..." value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
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
                  <button type="button" onClick={() => removePhoto(url)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <Textarea placeholder="Notas adicionales..." value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending || !form.client_id} className="gap-2 min-w-32">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Parte
          </Button>
        </div>
      </form>
    </div>
  );
}