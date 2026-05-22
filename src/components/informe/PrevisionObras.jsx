import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Building2, Users, Calendar, Clock,
  Save, Loader2, X, ChevronDown, ChevronUp, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO, differenceInDays, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const statusCfg = {
  planificada: { label: 'Planificada', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_curso:    { label: 'En curso',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completada:  { label: 'Completada',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelada:   { label: 'Cancelada',   className: 'bg-red-50 text-red-700 border-red-200' },
};

const emptyForm = {
  obra_id: '', obra_name: '', client_id: '', client_name: '',
  fecha_inicio: '', fecha_fin: '', horas_totales_previstas: '',
  notas: '', status: 'planificada', operarios_asignados: [],
};

export default function PrevisionObras() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: previsiones = [], isLoading } = useQuery({
    queryKey: ['previsiones_obra'],
    queryFn: () => base44.entities.PrevisionObra.list('-fecha_inicio', 300),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 300),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.PrevisionObra.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Previsión creada'); close_(); },
    onError: () => toast.error('Error al crear la previsión'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.PrevisionObra.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Previsión actualizada'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.PrevisionObra.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Previsión eliminada'); },
  });

  const open_ = (p = null) => {
    setEditing(p);
    setForm(p ? { ...p, horas_totales_previstas: p.horas_totales_previstas || '' } : emptyForm);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleObraChange = id => {
    const o = obras.find(x => x.id === id);
    if (!o) return;
    const c = clientes.find(x => x.id === o.client_id);
    setForm(p => ({
      ...p,
      obra_id: id,
      obra_name: o.name,
      client_id: o.client_id || '',
      client_name: c?.name || o.client_name || '',
      fecha_inicio: o.start_date || p.fecha_inicio,
      fecha_fin: o.end_date || p.fecha_fin,
    }));
  };

  const handleClientChange = id => {
    const c = clientes.find(x => x.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  // Operario assignment
  const addOperario = () => {
    setForm(p => ({
      ...p,
      operarios_asignados: [...(p.operarios_asignados || []), { operario_id: '', operario_name: '', rol: '', horas_previstas: '' }],
    }));
  };
  const updateOp = (idx, field, val) => {
    setForm(p => {
      const arr = [...(p.operarios_asignados || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      if (field === 'operario_id') {
        const op = operarios.find(o => o.id === val);
        arr[idx].operario_name = op?.name || '';
        arr[idx].rol = op?.role || '';
      }
      return { ...p, operarios_asignados: arr };
    });
  };
  const removeOp = idx => {
    setForm(p => ({ ...p, operarios_asignados: p.operarios_asignados.filter((_, i) => i !== idx) }));
  };

  const handleSave = () => {
    const data = {
      ...form,
      horas_totales_previstas: form.horas_totales_previstas ? parseFloat(form.horas_totales_previstas) : null,
      operarios_asignados: (form.operarios_asignados || []).map(op => ({
        ...op,
        horas_previstas: op.horas_previstas ? parseFloat(op.horas_previstas) : null,
      })).filter(op => op.operario_id),
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  // Grouping by client
  const clients = [...new Set(previsiones.map(p => p.client_name).filter(Boolean))].sort();

  const filtered = previsiones.filter(p => {
    const matchC = clientFilter === 'all' || p.client_name === clientFilter;
    const matchS = statusFilter === 'all' || p.status === statusFilter;
    return matchC && matchS;
  });

  // Group by client
  const grouped = clients
    .filter(c => clientFilter === 'all' || c === clientFilter)
    .map(c => ({
      client: c,
      items: filtered.filter(p => p.client_name === c),
    }))
    .filter(g => g.items.length > 0);

  // Items without client
  const sinCliente = filtered.filter(p => !p.client_name);
  if (sinCliente.length) grouped.push({ client: 'Sin cliente', items: sinCliente });

  const isPending = createM.isPending || updateM.isPending;

  const duracion = (p) => {
    if (!p.fecha_inicio || !p.fecha_fin) return null;
    return differenceInDays(parseISO(p.fecha_fin), parseISO(p.fecha_inicio)) + 1;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} previsiones</p>
        <Button onClick={() => open_()} size="sm" className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Nueva previsión
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="flex-1">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => <MobileSelectItem key={c} value={c}>{c}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos</MobileSelectItem>
          {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* Resumen badges */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCfg).map(([k, v]) => {
          const count = previsiones.filter(p => p.status === k).length;
          if (!count) return null;
          return <Badge key={k} variant="outline" className={`text-xs ${v.className}`}>{v.label}: {count}</Badge>;
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay previsiones de obra</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Crear previsión
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ client, items }) => (
            <div key={client}>
              {/* Client header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{client}</h3>
                <span className="text-xs text-muted-foreground">({items.length} obra{items.length !== 1 ? 's' : ''})</span>
              </div>

              <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                {items.map(p => {
                  const cfg = statusCfg[p.status] || statusCfg.planificada;
                  const isExpanded = expandedId === p.id;
                  const dias = duracion(p);
                  const totalHorasPrev = (p.operarios_asignados || []).reduce((s, op) => s + (op.horas_previstas || 0), 0);
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.obra_name}</span>
                              <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                              {p.operarios_asignados?.length > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <Users className="w-2.5 h-2.5 mr-1" />{p.operarios_asignados.length} asignados
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {p.fecha_inicio && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(parseISO(p.fecha_inicio), 'd MMM yyyy', { locale: es })}
                                  <Badge variant="outline" className="text-[10px] font-bold ml-1 h-6 border-2 border-primary/30 bg-primary/10 text-primary">
                                    S{getWeek(parseISO(p.fecha_inicio), { weekStartsOn: 1 })}
                                  </Badge>
                                </span>
                              )}
                              {p.fecha_fin && <span>→ {format(parseISO(p.fecha_fin), 'd MMM yyyy', { locale: es })}</span>}
                              {dias && <span>({dias} días)</span>}
                              {(p.horas_totales_previstas || totalHorasPrev > 0) && (
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.horas_totales_previstas || totalHorasPrev}h previstas</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(p)}><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar previsión?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteM.mutate(p.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3 text-xs">
                          {p.notas && <p className="text-muted-foreground italic">{p.notas}</p>}
                          {p.operarios_asignados?.length > 0 ? (
                            <div>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-2">Operarios asignados</p>
                              <div className="space-y-1.5">
                                {p.operarios_asignados.map((op, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-card rounded-lg px-3 py-2 border border-border">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                                      {op.operario_name?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium">{op.operario_name}</p>
                                      {op.rol && <p className="text-muted-foreground">{op.rol}</p>}
                                    </div>
                                    {op.horas_previstas > 0 && (
                                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                        <Clock className="w-2.5 h-2.5 mr-1" />{op.horas_previstas}h
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {totalHorasPrev > 0 && (
                                <p className="mt-2 font-semibold text-primary text-right">Total previsto: {totalHorasPrev}h</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">Sin operarios asignados</p>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar previsión' : 'Nueva previsión de obra'}</DialogTitle></DialogHeader>

          <div className="space-y-4 py-1">
            {/* Obra y cliente */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Obra (seleccionar existente)</Label>
                <MobileSelect value={form.obra_id} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
                  {obras.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">O escribir nombre de obra *</Label>
                <Input value={form.obra_name} onChange={e => set('obra_name', e.target.value)} placeholder="Nombre de la obra" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Cliente</Label>
                <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                  {clientes.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha inicio *</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha fin prevista</Label>
                <Input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <MobileSelect value={form.status} onValueChange={v => set('status', v)} placeholder="Estado">
                  {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas totales previstas</Label>
                <Input type="number" min="0" value={form.horas_totales_previstas} onChange={e => set('horas_totales_previstas', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Notas..." />
              </div>
            </div>

            {/* Asignación operarios */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Asignación de operarios
                </Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addOperario}>
                  <Plus className="w-3 h-3" /> Añadir
                </Button>
              </div>

              {(form.operarios_asignados || []).length === 0 ? (
                <div className="border border-dashed rounded-lg py-4 text-center text-xs text-muted-foreground">
                  Sin operarios asignados. Pulsa "Añadir" para asignar.
                </div>
              ) : (
                <div className="space-y-2">
                  {(form.operarios_asignados || []).map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <MobileSelect value={op.operario_id} onValueChange={v => updateOp(idx, 'operario_id', v)} placeholder="Operario...">
                          {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                        </MobileSelect>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Horas previstas"
                          value={op.horas_previstas}
                          onChange={e => updateOp(idx, 'horas_previstas', e.target.value)}
                          className="h-9 text-xs"
                        />
                        <Input
                          placeholder="Rol / función (opcional)"
                          value={op.rol}
                          onChange={e => updateOp(idx, 'rol', e.target.value)}
                          className="col-span-2 h-9 text-xs"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeOp(idx)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.obra_name || !form.fecha_inicio || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}