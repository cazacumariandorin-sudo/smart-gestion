import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import WorkerFields from '@/components/workorders/WorkerFields';
import MaterialFields from '@/components/workorders/MaterialFields';

export default function CreateWorkOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    client_name: '',
    project: '',
    description: '',
    status: 'pendiente',
    workers: [],
    materials: [],
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.create(data),
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nuevo Parte de Trabajo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Completa los datos del parte</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Obra *</Label>
              <Input placeholder="Nombre de la obra" value={form.project} onChange={(e) => updateField('project', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea placeholder="Descripción del trabajo realizado..." value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
          </div>
        </Card>

        <Card className="p-5">
          <WorkerFields workers={form.workers} onChange={(w) => updateField('workers', w)} />
        </Card>

        <Card className="p-5">
          <MaterialFields materials={form.materials} onChange={(m) => updateField('materials', m)} />
        </Card>

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