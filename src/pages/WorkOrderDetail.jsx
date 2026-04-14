import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, Trash2, Pencil, Calendar, Clock, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import WorkerFields from '@/components/workorders/WorkerFields';
import MaterialFields from '@/components/workorders/MaterialFields';
import PhotoUploader from '@/components/workorders/PhotoUploader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const statusConfig = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_curso: { label: 'En curso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completado: { label: 'Completado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function WorkOrderDetail() {
  const orderId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['workorder', orderId],
    queryFn: async () => {
      const orders = await base44.entities.WorkOrder.filter({ id: orderId });
      return orders[0];
    },
    enabled: !!orderId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.update(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', orderId] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.WorkOrder.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      navigate('/work-orders');
    },
  });

  const startEditing = () => {
    setForm({
      date: order.date || '',
      client_id: order.client_id || '',
      client_name: order.client_name || '',
      project: order.project || '',
      description: order.description || '',
      status: order.status || 'pendiente',
      workers: order.workers || [],
      materials: order.materials || [],
      notes: order.notes || '',
    });
    setEditing(true);
  };

  const handleSave = () => {
    const totalHours = form.workers.reduce((sum, w) => sum + (w.hours || 0), 0);
    updateMutation.mutate({ ...form, total_hours: totalHours });
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => ({ ...prev, client_id: clientId, client_name: client?.name || '' }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center"><p className="text-muted-foreground">Parte no encontrado</p></div>;
  }

  const status = statusConfig[order.status] || statusConfig.pendiente;

  if (editing) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">Editar Parte</h1>
        </div>
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-sm">Información General</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
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
                <Label className="text-xs">Cliente</Label>
                <Select value={form.client_id} onValueChange={handleClientChange}>
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
                <Label className="text-xs">Obra</Label>
                <Input value={form.project} onChange={(e) => updateField('project', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
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
            <Textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 min-w-32">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{order.project}</h1>
            <p className="text-sm text-muted-foreground">{order.client_name || order.client}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive h-8 w-8">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar parte?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant="outline" className={`${status.className} font-medium`}>
            {status.label}
          </Badge>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {order.date ? format(new Date(order.date), "d 'de' MMMM yyyy", { locale: es }) : '—'}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-4 h-4" />
            {order.total_hours || 0} horas
          </span>
        </div>
        {order.description && (
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{order.description}</p>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" /> Operarios ({order.workers?.length || 0})
        </h3>
        {order.workers?.length > 0 ? (
          <div className="space-y-2">
            {order.workers.map((w, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{w.name}</p>
                  {w.role && <p className="text-xs text-muted-foreground">{w.role}</p>}
                </div>
                <span className="text-sm font-semibold">{w.hours}h</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin operarios asignados</p>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-primary" /> Materiales ({order.materials?.length || 0})
        </h3>
        {order.materials?.length > 0 ? (
          <div className="space-y-2">
            {order.materials.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium">{m.name}</p>
                <span className="text-sm text-muted-foreground">{m.quantity} {m.unit}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin materiales registrados</p>
        )}
      </Card>

      {order.notes && (
        <Card className="p-5 mb-4">
          <h3 className="font-semibold text-sm mb-2">Observaciones</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{order.notes}</p>
        </Card>
      )}

      <Card className="p-5">
        <PhotoUploader
          workOrderId={order.id}
          clientId={order.client_id}
          clientName={order.client_name}
          project={order.project}
          date={order.date}
        />
      </Card>
    </div>
  );
}