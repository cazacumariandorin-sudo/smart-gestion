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
import { ArrowLeft, Save, Loader2, Trash2, Pencil, Calendar, Clock, Users, Package, Download } from 'lucide-react';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import { jsPDF } from 'jspdf';
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
      hora_inicio: order.hora_inicio || '',
      hora_fin: order.hora_fin || '',
      workers: order.workers || [],
      materials: order.materials || [],
      notes: order.notes || '',
      firma_operario: order.firma_operario || '',
      firma_cliente: order.firma_cliente || '',
    });
    setEditing(true);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Parte de Trabajo', margin, y); y += 8;
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`${order.project} — ${order.client_name || ''}`, margin, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Fecha: ${order.date || '—'}  |  Estado: ${order.status}  |  Horas: ${order.total_hours || 0}h`, margin, y); y += 4;
    if (order.hora_inicio || order.hora_fin) {
      doc.text(`Hora inicio: ${order.hora_inicio || '—'}  |  Hora fin: ${order.hora_fin || '—'}`, margin, y); y += 4;
    }
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, 196, y); y += 6;

    if (order.description) {
      doc.setFontSize(10); doc.setTextColor(40,40,40);
      doc.text('Descripción:', margin, y); y += 5;
      doc.setFontSize(9); doc.setTextColor(80,80,80);
      const lines = doc.splitTextToSize(order.description, 180);
      doc.text(lines, margin, y); y += lines.length * 5 + 4;
    }

    if (order.workers?.length) {
      doc.setFontSize(10); doc.setTextColor(40,40,40);
      doc.text('Operarios:', margin, y); y += 5;
      order.workers.forEach(w => {
        doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`• ${w.name}${w.role ? ' (' + w.role + ')' : ''} — ${w.hours}h`, margin + 4, y); y += 5;
      });
      y += 2;
    }

    if (order.materials?.length) {
      doc.setFontSize(10); doc.setTextColor(40,40,40);
      doc.text('Materiales:', margin, y); y += 5;
      order.materials.forEach(m => {
        doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`• ${m.name} — ${m.quantity} ${m.unit}`, margin + 4, y); y += 5;
      });
      y += 2;
    }

    if (order.notes) {
      doc.setFontSize(10); doc.setTextColor(40,40,40);
      doc.text('Observaciones:', margin, y); y += 5;
      doc.setFontSize(9); doc.setTextColor(80,80,80);
      const lines = doc.splitTextToSize(order.notes, 180);
      doc.text(lines, margin, y); y += lines.length * 5 + 4;
    }

    // Signatures
    y = Math.max(y, 200);
    doc.setDrawColor(180,180,180);
    doc.line(margin, y, 95, y);
    doc.line(110, y, 196, y);
    doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text('Firma Operario', margin, y + 4);
    doc.text('Firma Cliente', 110, y + 4);

    if (order.firma_operario) {
      doc.addImage(order.firma_operario, 'PNG', margin, y - 25, 75, 22);
    }
    if (order.firma_cliente) {
      doc.addImage(order.firma_cliente, 'PNG', 110, y - 25, 75, 22);
    }

    doc.save(`parte-${order.project?.replace(/\s+/g, '-')}-${order.date}.pdf`);
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
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-sm">Firmas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SignatureCanvas label="Firma del Operario" value={form.firma_operario} onChange={v => updateField('firma_operario', v)} />
              <SignatureCanvas label="Firma del Cliente" value={form.firma_cliente} onChange={v => updateField('firma_cliente', v)} />
            </div>
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
          <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
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
          {order.hora_inicio && (
            <span className="text-muted-foreground text-sm">{order.hora_inicio}{order.hora_fin ? ` → ${order.hora_fin}` : ''}</span>
          )}
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

      {(order.firma_operario || order.firma_cliente) && (
        <Card className="p-5 mb-4">
          <h3 className="font-semibold text-sm mb-3">Firmas</h3>
          <div className="grid grid-cols-2 gap-4">
            {order.firma_operario && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Operario</p>
                <img src={order.firma_operario} alt="Firma operario" className="border rounded-lg max-h-20 bg-white" />
              </div>
            )}
            {order.firma_cliente && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                <img src={order.firma_cliente} alt="Firma cliente" className="border rounded-lg max-h-20 bg-white" />
              </div>
            )}
          </div>
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