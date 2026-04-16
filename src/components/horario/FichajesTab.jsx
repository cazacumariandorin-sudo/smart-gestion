import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calcularHoras } from '@/lib/horasUtils';
import { Plus, Search, Trash2, Pencil, Save, Loader2, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const empty = { operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0], hora_entrada: '', hora_salida: '', pausa_inicio: '', pausa_fin: '', project: '', notas: '' };

export default function FichajesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: fichajes = [], isLoading } = useQuery({ queryKey: ['fichajes'], queryFn: () => base44.entities.Fichaje.list('-date', 500) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });

  const createM = useMutation({ mutationFn: d => base44.entities.Fichaje.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichajes'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.Fichaje.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichajes'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.Fichaje.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fichajes'] }) });

  const open_ = (f = null) => { setEditing(f); setForm(f ? { ...f } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
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

  const filtered = fichajes.filter(f => {
    const q = search.toLowerCase();
    const mQ = !search || f.operario_name?.toLowerCase().includes(q) || f.project?.toLowerCase().includes(q);
    const mOp = opFilter === 'all' || f.operario_id === opFilter;
    const mMonth = !monthFilter || f.date?.startsWith(monthFilter);
    return mQ && mOp && mMonth;
  });

  const totalHoras = filtered.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
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
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Operario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
          {filtered.map(f => (
            <Card key={f.id} className="p-4 flex items-center gap-4">
              <div className="w-12 text-center shrink-0">
                <p className="text-xs font-bold text-primary">{f.date ? format(parseISO(f.date), 'dd', { locale: es }) : '--'}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{f.date ? format(parseISO(f.date), 'EEE', { locale: es }) : '--'}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{f.operario_name}</span>
                  {statusBadge(f)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {f.hora_entrada || '--'} → {f.hora_salida || '--'}
                  {f.pausa_inicio && f.pausa_fin && <span className="ml-2 text-amber-600">(pausa {f.pausa_inicio}-{f.pausa_fin})</span>}
                </p>
                {f.project && <p className="text-xs text-muted-foreground truncate">📍 {f.project}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
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
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Fichaje' : 'Nuevo Fichaje'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              <Select value={form.operario_id} onValueChange={handleOpChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar operario..." /></SelectTrigger>
                <SelectContent>{operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <Input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Nombre obra..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora entrada *</Label>
                <Input type="time" value={form.hora_entrada} onChange={e => set('hora_entrada', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora salida</Label>
                <Input type="time" value={form.hora_salida} onChange={e => set('hora_salida', e.target.value)} />
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
              <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
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