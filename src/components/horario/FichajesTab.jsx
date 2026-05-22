import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { calcularHoras } from '@/lib/horasUtils';
import { Plus, Search, Trash2, Pencil, Save, Loader2, Clock, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const UNITS = ['m', 'm²', 'm³', 'ud', 'kg', 'l', 'h', 'ml', 'tn'];
const emptyApunte = { concepto: '', unidad: 'ud', cantidad: '', precio_unitario: '', total: '' };
const empty = { operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0], hora_entrada: '', hora_salida: '', pausa_inicio: '', pausa_fin: '', project: '', notas: '' };

export default function FichajesTab() {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, isControlHorarioOnly, user } = useUserRole();
  const canEditExitTime = isAdmin || isJefeObra;
  const canSeeAll = isAdmin || isJefeObra; // control_horario only sees own records
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [apuntes, setApuntes] = useState([]); // apuntes del fichaje en edición/creación
  const [expandedId, setExpandedId] = useState(null); // fichaje expandido para ver apuntes

  const { data: fichajes = [], isLoading } = useQuery({ queryKey: ['fichajes'], queryFn: () => base44.entities.Fichaje.list('-date', 500) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list('name', 200) });
  const { data: allApuntes = [] } = useQuery({ queryKey: ['apuntes'], queryFn: () => base44.entities.ApunteHorario.list('-date', 1000) });

  const createM = useOptimisticMutation(
    async (d) => {
      const fichaje = await base44.entities.Fichaje.create(d);
      const validApuntes = apuntes.filter(a => a.concepto && a.cantidad);
      await Promise.all(validApuntes.map(a => base44.entities.ApunteHorario.create({
        operario_id: d.operario_id, operario_name: d.operario_name,
        date: d.date, obra_name: d.project || '',
        concepto: a.concepto, unidad: a.unidad,
        cantidad: parseFloat(a.cantidad) || 0,
        precio_unitario: parseFloat(a.precio_unitario) || undefined,
        total: a.total || undefined,
      })));
      return fichaje;
    },
    'fichajes',
    (prev, d) => [...prev, { ...d, id: `temp_${Date.now()}`, horas_trabajadas: calcularHoras(d.hora_entrada, d.hora_salida, d.pausa_inicio, d.pausa_fin) }],
    () => { close_(); qc.invalidateQueries({ queryKey: ['apuntes'] }); }
  );
  const updateM = useOptimisticMutation(
    ({ id, d }) => base44.entities.Fichaje.update(id, d),
    'fichajes',
    (prev, { id, d }) => prev.map(f => f.id === id ? { ...f, ...d, horas_trabajadas: calcularHoras(d.hora_entrada, d.hora_salida, d.pausa_inicio, d.pausa_fin) } : f),
    () => close_()
  );
  const deleteM = useMutation({ mutationFn: id => base44.entities.Fichaje.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fichajes'] }) });
  const deleteApunteM = useMutation({ mutationFn: id => base44.entities.ApunteHorario.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['apuntes'] }) });

  const open_ = (f = null) => {
    setEditing(f);
    if (f) {
      setForm({ ...f });
    } else if (isControlHorarioOnly && myOperario) {
      setForm({ ...empty, operario_id: myOperario.id, operario_name: myOperario.name });
    } else {
      setForm(empty);
    }
    setApuntes([]);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); setApuntes([]); };

  // Apuntes inline form helpers
  const addApunte = () => setApuntes(p => [...p, { ...emptyApunte }]);
  const removeApunte = i => setApuntes(p => p.filter((_, idx) => idx !== i));
  const setApunteField = (i, k, v) => setApuntes(p => {
    const next = [...p];
    next[i] = { ...next[i], [k]: v };
    if (k === 'cantidad' || k === 'precio_unitario') {
      const qty = parseFloat(k === 'cantidad' ? v : next[i].cantidad) || 0;
      const price = parseFloat(k === 'precio_unitario' ? v : next[i].precio_unitario) || 0;
      next[i].total = qty && price ? +(qty * price).toFixed(2) : '';
    }
    return next;
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOpChange = id => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const handleSave = () => {
    const horas = calcularHoras(form.hora_entrada, form.hora_salida, form.pausa_inicio, form.pausa_fin);
    const data = { ...form, horas_trabajadas: horas };
    editing ? updateM.mutate({ id: editing.id, d: data }) : createM.mutate(data);
  };

  // For control_horario role, find their own operario record and restrict to it
  // Try to match by user_email first (new way), fallback to email field (old way)
  const myOperario = isControlHorarioOnly
    ? (operarios.find(o => o.user_email === user?.email) || operarios.find(o => o.email === user?.email))
    : null;

  const filtered = fichajes.filter(f => {
    // control_horario only sees their own fichajes
    if (isControlHorarioOnly) {
      if (!myOperario || f.operario_id !== myOperario.id) return false;
    }
    const q = search.toLowerCase();
    const mQ = !search || f.operario_name?.toLowerCase().includes(q) || f.project?.toLowerCase().includes(q);
    const mOp = opFilter === 'all' || f.operario_id === opFilter;
    const mMonth = !monthFilter || f.date?.startsWith(monthFilter);
    return mQ && mOp && mMonth;
  });

  const totalHoras = filtered.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);

  // Get apuntes linked to a fichaje (same operario + date)
  const getApuntesForFichaje = (f) =>
    allApuntes.filter(a => a.operario_id === f.operario_id && a.date === f.date);
  const isPending = createM.isPending || updateM.isPending;

  const statusBadge = (f) => {
    if (!f.hora_entrada) return <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600">Sin fichar</Badge>;
    if (!f.hora_salida) return <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700">En trabajo</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700">{f.horas_trabajadas?.toFixed(1)}h</Badge>;
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar operario u obra..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full sm:w-40" />
        {canSeeAll && (
          <MobileSelect value={opFilter} onValueChange={setOpFilter} placeholder="Operario" triggerClassName="w-full sm:w-44">
            <MobileSelectItem value="all">Todos</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        )}
        <Button onClick={() => open_()} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Fichaje
        </Button>
      </div>

      {/* Summary */}
      <Card className="p-4 mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{filtered.length} fichajes filtrados</span>
        <span className="font-bold text-lg text-primary">{totalHoras.toFixed(1)} h totales</span>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay fichajes para este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const fApuntes = getApuntesForFichaje(f);
            const isExpanded = expandedId === f.id;
            return (
              <Card key={f.id} className="overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-xs font-bold text-primary">{f.date ? format(parseISO(f.date), 'dd', { locale: es }) : '--'}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{f.date ? format(parseISO(f.date), 'EEE', { locale: es }) : '--'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.operario_name}</span>
                      {statusBadge(f)}
                      {fApuntes.length > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200 gap-1">
                          <ClipboardList className="w-2.5 h-2.5" />{fApuntes.length} apunte{fApuntes.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.hora_entrada || '--'} → {f.hora_salida || '--'}
                      {f.pausa_inicio && f.pausa_fin && <span className="ml-2 text-amber-600">(pausa {f.pausa_inicio}-{f.pausa_fin})</span>}
                    </p>
                    {f.project && <p className="text-xs text-muted-foreground truncate">📍 {f.project}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {fApuntes.length > 0 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open_(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar fichaje?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(f.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {isExpanded && fApuntes.length > 0 && (
                  <div className="border-t border-border bg-violet-50/40 dark:bg-violet-950/10 px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1 mb-2">
                      <ClipboardList className="w-3 h-3" /> Apuntes de cantidades
                    </p>
                    {fApuntes.map(a => (
                      <div key={a.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="flex-1 truncate text-foreground">{a.concepto}</span>
                        <span className="font-semibold text-violet-700 shrink-0">{a.cantidad} {a.unidad}</span>
                        {a.total > 0 && <span className="text-emerald-600 shrink-0">{a.total} €</span>}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar apunte?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteApunteM.mutate(a.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Fichaje' : 'Nuevo Fichaje'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              {canSeeAll ? (
                <MobileSelect value={form.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                  {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                </MobileSelect>
              ) : (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {myOperario?.name || user?.full_name || 'Mi perfil'}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <MobileSelect value={form.project} onValueChange={v => set('project', v)} placeholder="Seleccionar obra...">
                  <MobileSelectItem value="">Sin especificar</MobileSelectItem>
                  {obras.map(o => <MobileSelectItem key={o.id} value={o.name}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora entrada *</Label>
                <Input type="time" value={form.hora_entrada} onChange={e => set('hora_entrada', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora salida</Label>
                <Input
                  type="time"
                  value={form.hora_salida}
                  onChange={e => {
                    const val = e.target.value;
                    // Non-admins: cannot set exit time in future
                    if (!canEditExitTime) {
                      const now = new Date();
                      const [h, m] = val.split(':').map(Number);
                      const nowMinutes = now.getHours() * 60 + now.getMinutes();
                      const selectedMinutes = h * 60 + m;
                      if (selectedMinutes > nowMinutes) return;
                    }
                    set('hora_salida', val);
                  }}
                />
                {!canEditExitTime && <p className="text-[10px] text-muted-foreground">No se puede registrar hora futura</p>}
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">🍽️ Pausa comida</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Inicio pausa</Label>
                  <Input type="time" value={form.pausa_inicio} onChange={e => set('pausa_inicio', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin pausa</Label>
                  <Input type="time" value={form.pausa_fin} onChange={e => set('pausa_fin', e.target.value)} />
                </div>
              </div>
            </div>
            {form.hora_entrada && form.hora_salida && (
              <div className="bg-primary/5 rounded-lg px-3 py-2 text-sm text-center">
                ⏱️ <strong>{calcularHoras(form.hora_entrada, form.hora_salida, form.pausa_inicio, form.pausa_fin).toFixed(2)}h</strong> netas trabajadas
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <div className="flex gap-1 items-start">
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." className="flex-1" />
                <VoiceInputButton onResult={txt => set('notas', form.notas ? form.notas + ' ' + txt : txt)} />
              </div>
            </div>

            {/* Apuntes de cantidades */}
            {!editing && (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Apuntes de cantidades</p>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addApunte}>
                    <Plus className="w-3 h-3" /> Añadir
                  </Button>
                </div>
                {apuntes.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
                    <div className="col-span-5 flex gap-1">
                      <Input value={a.concepto} onChange={e => setApunteField(i, 'concepto', e.target.value)} placeholder="Concepto..." className="h-8 text-xs flex-1" />
                      <VoiceInputButton onResult={txt => setApunteField(i, 'concepto', txt)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" step="0.01" value={a.cantidad} onChange={e => setApunteField(i, 'cantidad', e.target.value)} placeholder="Cant." className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <MobileSelect value={a.unidad} onValueChange={v => setApunteField(i, 'unidad', v)} placeholder="Ud" triggerClassName="h-8 text-xs">
                        {UNITS.map(u => <MobileSelectItem key={u} value={u}>{u}</MobileSelectItem>)}
                      </MobileSelect>
                    </div>
                    <div className="col-span-2">
                      <Input type="number" step="0.01" value={a.precio_unitario} onChange={e => setApunteField(i, 'precio_unitario', e.target.value)} placeholder="€/ud" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeApunte(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {a.total > 0 && <div className="col-span-12 text-[10px] text-emerald-600 font-semibold pl-1">= {a.total} €</div>}
                  </div>
                ))}
                {apuntes.length === 0 && <p className="text-[10px] text-muted-foreground">Sin apuntes de cantidades para este fichaje.</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.operario_id || !form.hora_entrada || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}