
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AutoCorrectTextarea from '@/components/ui/AutoCorrectTextarea';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import DesplazamientoFields from '@/components/partes/DesplazamientoFields';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Trash2, Pencil, Calendar, Clock, Users, Package, Download, Car, Euro } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import WorkerFields from '@/components/workorders/WorkerFields';
import MaterialFields from '@/components/workorders/MaterialFields';
import PhotoUploader from '@/components/workorders/PhotoUploader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/lib/useUserRole';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';
import { getEmpresaPrincipalPdf, drawEmpresaDatosPdf } from '@/lib/simantecEmpresaPdf';
import {
  limpiarParte, validarFilas, calcularFirmaStatus, mensajeErrorGuardado,
  DESPLAZAMIENTO_LABELS, FIRMA_STATUS_LABELS,
} from '@/lib/workOrderUtils';

const fmtFecha = (iso, pat = 'dd/MM/yyyy HH:mm') => {
  try { return iso ? format(parseISO(iso), pat) : ''; } catch { return ''; }
};

const statusConfig = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_curso: { label: 'En curso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completado: { label: 'Completado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const firmaStatusConfig = {
  sin_firmar: { label: 'Sin firmar', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  pendiente_cliente: { label: 'Pendiente cliente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  pendiente_tecnico: { label: 'Pendiente tecnico', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  firmado_tecnico: { label: 'Firmado tecnico', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  firmado_ambos: { label: 'Firmado ✓', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function WorkOrderDetail() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isGerencia } = useUserRole();
  const canDelete = isAdmin || isGerencia;
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

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
    enabled: editing,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.update(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', orderId] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      setEditing(false);
      toast.success('✅ Parte guardado correctamente');
    },
    onError: (err) => {
      console.error('[WorkOrder] Error al actualizar', err);
      toast.error(mensajeErrorGuardado(err), { duration: 9000 });
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
      obra_id: order.obra_id || '',
      description: order.description || '',
      status: order.status || 'pendiente',
      hora_inicio: order.hora_inicio || '',
      hora_fin: order.hora_fin || '',
      workers: order.workers || [],
      materials: order.materials || [],
      notes: order.notes || '',
      firma_operario: order.firma_operario || '',
      firma_cliente: order.firma_cliente || '',
      vehiculo_id: order.vehiculo_id || '',
      vehiculo_matricula: order.vehiculo_matricula || '',
      desplazamiento_tipo: order.desplazamiento_tipo || '',
      desplazamiento_valor: order.desplazamiento_valor ?? '',
      desplazamiento_importe_eur: order.desplazamiento_importe_eur ?? '',
    });
    setEditing(true);
  };

  const downloadPDF = async () => {
    const empresa = await getEmpresaPrincipalPdf();
    const doc = new jsPDF();
    const margin = 14;
    const bottom = doc.internal.pageSize.getHeight() - 18;
    let y = 12;
    const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = 16; } };
    const heading = (t) => { ensure(12); doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.text(t, margin, y); y += 5; };
    const text = (t, indent = 0) => {
      doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      doc.splitTextToSize(String(t), 182 - indent).forEach((l) => { ensure(5); doc.text(l, margin + indent, y); y += 5; });
    };

    const logoH = drawSimantecLogoPdf(doc, margin, y, 16);
        drawEmpresaDatosPdf(doc, empresa, 196, 16);
    y = 12 + logoH + 4;

    doc.setFontSize(18); doc.setTextColor(40, 40, 40);
    doc.text(`Parte de Trabajo${order.order_number ? ' · ' + order.order_number : ''}`, margin, y); y += 8;
    doc.setFontSize(11); doc.setTextColor(100, 100, 100);
    doc.text(`${order.project || ''} — ${order.client_name || ''}`, margin, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Fecha: ${order.date || '—'}  |  Estado: ${statusConfig[order.status]?.label || order.status}  |  Horas: ${order.total_hours || 0}h`, margin, y); y += 4;
    if (order.hora_inicio || order.hora_fin) {
      doc.text(`Hora inicio: ${order.hora_inicio || '—'}  |  Hora fin: ${order.hora_fin || '—'}`, margin, y); y += 4;
    }
    doc.text(`Firma: ${FIRMA_STATUS_LABELS[order.firma_status] || 'Sin firmar'}`, margin, y); y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, 196, y); y += 6;

    if (order.description) { heading('Descripción:'); text(order.description); y += 2; }

    if (order.workers?.length) {
      heading('Operarios:');
      order.workers.forEach((w) => text(`• ${w.name}${w.role ? ' (' + w.role + ')' : ''} — ${w.hours || 0}h`, 4));
      y += 2;
    }
    if (order.materials?.length) {
      heading('Materiales:');
      order.materials.forEach((m) => text(`• ${m.name} — ${m.quantity || 0} ${m.unit || ''}`, 4));
      y += 2;
    }
    if (order.vehiculo_matricula || order.desplazamiento_tipo || order.desplazamiento_valor) {
      heading('Vehículo / Desplazamiento:');
      if (order.vehiculo_matricula) text(`• Vehículo: ${order.vehiculo_matricula}`, 4);
      if (order.desplazamiento_tipo) text(`• Tipo: ${DESPLAZAMIENTO_LABELS[order.desplazamiento_tipo] || order.desplazamiento_tipo}`, 4);
      if (order.desplazamiento_valor) text(`• Distancia: ${order.desplazamiento_valor} km${order.desplazamiento_importe_eur ? ' — ' + Number(order.desplazamiento_importe_eur).toFixed(2) + ' €' : ''}`, 4);
      y += 2;
    }
    if (order.notes) { heading('Observaciones:'); text(order.notes); y += 2; }

    // Firmas (con paginación)
    ensure(52);
    y += 28;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, 95, y);
    doc.line(110, y, 196, y);
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('Firma Operario', margin, y + 4);
    doc.text('Firma Cliente', 110, y + 4);
    const metaOp = fmtFecha(order.firma_operario_fecha);
    const metaCli = [order.firma_cliente_nombre, order.firma_cliente_nif, fmtFecha(order.firma_cliente_fecha)].filter(Boolean).join(' · ');
    if (metaOp) doc.text(metaOp, margin, y + 8);
    if (metaCli) doc.text(doc.splitTextToSize(metaCli, 85), 110, y + 8);
    try { if (order.firma_operario) doc.addImage(order.firma_operario, 'PNG', margin, y - 26, 60, 24); } catch (e) { console.warn('[PDF] firma operario', e); }
    try { if (order.firma_cliente) doc.addImage(order.firma_cliente, 'PNG', 110, y - 26, 60, 24); } catch (e) { console.warn('[PDF] firma cliente', e); }

    doc.save(`parte-${(order.order_number || order.project || 'parte').replace(/[^\w-]+/g, '-')}-${order.date}.pdf`);
  };

  const handleSave = () => {
    if (updateMutation.isPending) return;
    const datos = limpiarParte({ ...form }, { clear: true });
    if (!datos.date) { toast.error('Indica la fecha del parte'); return; }
    if (!datos.project) { toast.error('Selecciona o escribe la obra'); return; }
    const filas = validarFilas(datos.workers, datos.materials);
    if (!filas.ok) { toast.error(filas.error); return; }

    const ahora = new Date().toISOString();
    const extra = {};
    if (datos.firma_operario && datos.firma_operario !== (order.firma_operario || '')) extra.firma_operario_fecha = ahora;
    if (datos.firma_cliente && datos.firma_cliente !== (order.firma_cliente || '')) extra.firma_cliente_fecha = ahora;

    updateMutation.mutate({
      ...datos,
      workers: filas.workers,
      materials: filas.materials,
      total_hours: filas.workers.reduce((sum, w) => sum + (Number(w.hours) || 0), 0),
      firma_status: calcularFirmaStatus(order.firma_status, datos.firma_operario, datos.firma_cliente),
      ...extra,
    });
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const obrasFiltradas = form?.client_id ? obras.filter(o => o.client_id === form.client_id) : obras;

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => {
      const sig = { ...prev, client_id: clientId, client_name: client?.name || '' };
      const sigue = obras.find(o => o.id === prev.obra_id && o.client_id === clientId);
      if (!sigue && prev.obra_id) { sig.obra_id = ''; }
      return sig;
    });
  };

  const handleObraChange = (nombre) => {
    if (nombre === '__manual__') { setForm(prev => ({ ...prev, obra_id: '', project: '__manual__' })); return; }
    const obra = obras.find(o => o.name === nombre);
    if (obra) {
      setForm(prev => ({
        ...prev,
        obra_id: obra.id,
        project: obra.name,
        client_id: obra.client_id || prev.client_id,
        client_name: obra.client_name || prev.client_name,
      }));
    } else {
      setForm(prev => ({ ...prev, obra_id: '', project: nombre }));
    }
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
  const firmaStatus = firmaStatusConfig[order.firma_status] || firmaStatusConfig.sin_firmar;

  if (editing) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Editar Parte"
          onBack={() => setEditing(false)}
        />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-sm">Información General</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
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
                <Label className="text-xs">Cliente</Label>
                <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                  {clients.map(c => (
                    <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>
                  ))}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <MobileSelect value={form.project} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
                  {obrasFiltradas.map(o => <MobileSelectItem key={o.id} value={o.name}>{o.name}</MobileSelectItem>)}
                  {form.project && form.project !== '__manual__' && !obrasFiltradas.some(o => o.name === form.project) && (
                    <MobileSelectItem value={form.project}>{form.project}</MobileSelectItem>
                  )}
                  <MobileSelectItem value="__manual__">— Escribir manualmente —</MobileSelectItem>
                </MobileSelect>
                {(form.project === '__manual__' || (form.project && !obras.some(o => o.name === form.project))) && (
                  <Input placeholder="Nombre de la obra" value={form.project === '__manual__' ? '' : form.project} onChange={(e) => updateField('project', e.target.value)} className="mt-1" />
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
              <AutoCorrectTextarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
            </div>
          </Card>
          <Card className="p-5">
            <WorkerFields workers={form.workers} onChange={(w) => updateField('workers', w)} />
          </Card>
          <Card className="p-5">
            <MaterialFields materials={form.materials} onChange={(m) => updateField('materials', m)} />
          </Card>
          <DesplazamientoFields
            value={{
              vehiculo_id: form.vehiculo_id,
              vehiculo_matricula: form.vehiculo_matricula,
              desplazamiento_tipo: form.desplazamiento_tipo,
              desplazamiento_valor: form.desplazamiento_valor,
              desplazamiento_importe_eur: form.desplazamiento_importe_eur,
            }}
            onChange={(patch) => setForm(prev => ({ ...prev, ...patch }))}
          />
          <Card className="p-5 space-y-3">
            <Label className="text-sm font-semibold">Observaciones</Label>
            <AutoCorrectTextarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
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
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={order.project}
        subtitle={`${order.order_number ? order.order_number + ' · ' : ''}${order.client_name || order.client || ''}`}
        backTo="/work-orders"
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={downloadPDF} className="h-10 w-10 rounded-full">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={startEditing} className="h-10 w-10 rounded-full">
              <Pencil className="w-4 h-4" />
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
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
            )}
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant="outline" className={`${status.className} font-medium`}>
            {status.label}
          </Badge>
          <Badge variant="outline" className={`${firmaStatus.className} font-medium`}>
            ✍ {firmaStatus.label}
          </Badge>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {order.date ? format(parseISO(order.date), "d 'de' MMMM yyyy", { locale: es }) : '—'}
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

      {(order.vehiculo_matricula || order.desplazamiento_tipo || order.desplazamiento_valor > 0) && (
        <Card className="p-5 mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Car className="w-4 h-4 text-primary" /> Vehículo / Desplazamiento
          </h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {order.vehiculo_matricula && <span>Vehículo: <b className="text-foreground">{order.vehiculo_matricula}</b></span>}
            {order.desplazamiento_tipo && <span>{DESPLAZAMIENTO_LABELS[order.desplazamiento_tipo] || order.desplazamiento_tipo}</span>}
            {order.desplazamiento_valor > 0 && <span>{order.desplazamiento_valor} km</span>}
            {order.desplazamiento_importe_eur > 0 && (
              <span className="flex items-center gap-1 text-primary font-medium"><Euro className="w-3.5 h-3.5" />{Number(order.desplazamiento_importe_eur).toFixed(2)} €</span>
            )}
          </div>
        </Card>
      )}

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
                {order.firma_operario_fecha && <p className="text-[10px] text-muted-foreground mt-1">{fmtFecha(order.firma_operario_fecha)}</p>}
              </div>
            )}
            {order.firma_cliente && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                <img src={order.firma_cliente} alt="Firma cliente" className="border rounded-lg max-h-20 bg-white" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {[order.firma_cliente_nombre, order.firma_cliente_nif, fmtFecha(order.firma_cliente_fecha)].filter(Boolean).join(' · ')}
                </p>
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
    </div>
  );
}
