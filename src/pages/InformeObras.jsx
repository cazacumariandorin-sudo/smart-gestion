import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Plus, ChevronLeft, ChevronRight, Building2, FolderOpen, CalendarDays,
  Loader2, Save, X, Users, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import PrevisionObraCard from '@/components/informe/PrevisionObraCard';
import PrevisionCalendario from '@/components/informe/PrevisionCalendario';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  planificada: { label: 'Planificada', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_curso:    { label: 'En curso',    className: 'bg-teal-50 text-teal-700 border-teal-200' },
  completada:  { label: 'Completada',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelada:   { label: 'Cancelada',   className: 'bg-red-50 text-red-700 border-red-200' },
};

const emptyForm = {
  obra_id: '', obra_name: '', client_id: '', client_name: '',
  fecha_inicio: '', fecha_fin: '', horas_totales_previstas: '',
  notas: '', status: 'planificada', operarios_asignados: [],
};

// ── Day detail panel (modal) ─────────────────────────────────────────────────
function DayDetailModal({ day, items, onClose, onSwitchToObra }) {
  if (!day) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-base capitalize">{format(day, "EEEE d 'de' MMMM yyyy", { locale: es })}</h2>
            <p className="text-xs text-muted-foreground">{items.length} previsión{items.length !== 1 ? 'es' : ''} activas</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin previsiones este día</p>
          ) : items.map(p => {
            const cfg = STATUS_CFG[p.status] || STATUS_CFG.planificada;
            const horas = p.horas_totales_previstas
              || (p.operarios_asignados || []).reduce((s, op) => s + (op.horas_previstas || 0), 0);
            return (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{p.obra_name}</p>
                    {p.client_name && <p className="text-xs text-muted-foreground">{p.client_name}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.className}`}>{cfg.label}</Badge>
                </div>
                {horas > 0 && (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />{horas}h previstas
                  </p>
                )}
                {p.notas && <p className="text-xs text-muted-foreground italic">{p.notas}</p>}
                {p.operarios_asignados?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.operarios_asignados.map((op, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-medium">
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">
                          {op.operario_name?.[0]?.toUpperCase()}
                        </span>
                        {op.operario_name}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 mt-1"
                  onClick={() => { onSwitchToObra(p.obra_name); onClose(); }}
                >
                  <FolderOpen className="w-3 h-3 mr-1" /> Ver obra completa
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function InformeObras() {
  const qc = useQueryClient();
  const [view, setView] = useState('obra'); // 'obra' | 'mensual'
  const [month, setMonth] = useState(new Date());
  const [dayModal, setDayModal] = useState(null); // { day, items }
  const [focusObra, setFocusObra] = useState(null); // highlight a obra in folder view
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // ── Data ──
  const { data: previsiones = [], isLoading, refetch } = useQuery({
    queryKey: ['previsiones_obra'],
    queryFn: () => base44.entities.PrevisionObra.list('-fecha_inicio', 500),
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

  // ── Mutations ──
  const createM = useMutation({
    mutationFn: d => base44.entities.PrevisionObra.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Previsión creada'); close_(); },
    onError: () => toast.error('Error al crear la previsión'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.PrevisionObra.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Actualizado'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.PrevisionObra.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['previsiones_obra'] }); toast.success('Eliminado'); },
  });

  // ── Pull to refresh ──
  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  // ── Dialog helpers ──
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
      ...p, obra_id: id, obra_name: o.name,
      client_id: o.client_id || '', client_name: c?.name || o.client_name || '',
      fecha_inicio: o.start_date || p.fecha_inicio,
      fecha_fin: o.end_date || p.fecha_fin,
    }));
  };

  const addOperario = () => setForm(p => ({
    ...p, operarios_asignados: [...(p.operarios_asignados || []), { operario_id: '', operario_name: '', rol: '', horas_previstas: '' }],
  }));
  const updateOp = (idx, field, val) => setForm(p => {
    const arr = [...(p.operarios_asignados || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    if (field === 'operario_id') {
      const op = operarios.find(o => o.id === val);
      arr[idx].operario_name = op?.name || '';
      arr[idx].rol = op?.role || '';
    }
    return { ...p, operarios_asignados: arr };
  });
  const removeOp = idx => setForm(p => ({ ...p, operarios_asignados: p.operarios_asignados.filter((_, i) => i !== idx) }));

  const handleSave = () => {
    const data = {
      ...form,
      horas_totales_previstas: form.horas_totales_previstas ? parseFloat(form.horas_totales_previstas) : null,
      operarios_asignados: (form.operarios_asignados || [])
        .map(op => ({ ...op, horas_previstas: op.horas_previstas ? parseFloat(op.horas_previstas) : null }))
        .filter(op => op.operario_id),
    };
    editing ? updateM.mutate({ id: editing.id, d: data }) : createM.mutate(data);
  };

  // ── Group by obra ──
  const grouped = useMemo(() => {
    const map = {};
    previsiones.forEach(p => {
      const key = p.obra_name || 'Sin obra';
      if (!map[key]) map[key] = { obraName: key, clientName: p.client_name || '', registros: [] };
      map[key].registros.push(p);
    });
    return Object.values(map).sort((a, b) => a.obraName.localeCompare(b.obraName));
  }, [previsiones]);

  const handleSwitchToObra = (obraName) => {
    setView('obra');
    setFocusObra(obraName);
    setTimeout(() => setFocusObra(null), 3000);
  };

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Previsiones de Obra
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{previsiones.length} previsiones registradas</p>
        </div>
        <Button onClick={() => open_()} size="sm" className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nueva previsión</span>
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { value: 'obra',    label: 'Vista por Obra',  icon: FolderOpen,  color: 'bg-purple-500 hover:bg-purple-600 border-purple-600 shadow-purple-200' },
          { value: 'mensual', label: 'Vista Mensual',   icon: CalendarDays,color: 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-blue-200' },
        ].map(({ value, label, icon: Icon, color }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm text-white shadow-md',
              'transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95',
              color,
              view === value ? 'ring-2 ring-offset-2 ring-current scale-105 shadow-lg' : 'opacity-80',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Status summary badges */}
      <div className="flex gap-2 flex-wrap mb-5">
        {Object.entries(STATUS_CFG).map(([k, v]) => {
          const count = previsiones.filter(p => p.status === k).length;
          if (!count) return null;
          return <Badge key={k} variant="outline" className={`text-xs ${v.className}`}>{v.label}: {count}</Badge>;
        })}
      </div>

      {/* ── VISTA POR OBRA ── */}
      {view === 'obra' && (
        isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No hay previsiones de obra</p>
            <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Crear previsión
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(g => (
              <PrevisionObraCard
                key={g.obraName}
                obraName={g.obraName}
                clientName={g.clientName}
                registros={g.registros}
                forceOpen={focusObra === g.obraName}
                onEdit={open_}
                onDelete={id => deleteM.mutate(id)}
              />
            ))}
          </div>
        )
      )}

      {/* ── VISTA MENSUAL ── */}
      {view === 'mensual' && (
        <div>
          {/* Month navigator */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-2.5 mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: es })}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="h-96 rounded-xl bg-muted animate-pulse" />
          ) : (
            <PrevisionCalendario
              previsiones={previsiones}
              month={month}
              onDayClick={(day, items) => setDayModal({ day, items })}
            />
          )}
        </div>
      )}

      {/* Day detail modal */}
      {dayModal && (
        <DayDetailModal
          day={dayModal.day}
          items={dayModal.items}
          onClose={() => setDayModal(null)}
          onSwitchToObra={handleSwitchToObra}
        />
      )}

      {/* ── Form dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar previsión' : 'Nueva previsión de obra'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
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
                <MobileSelect value={form.client_id} onValueChange={id => { const c = clientes.find(x => x.id === id); setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' })); }} placeholder="Seleccionar cliente...">
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
                  {Object.entries(STATUS_CFG).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas totales previstas</Label>
                <Input type="number" min="0" value={form.horas_totales_previstas} onChange={e => set('horas_totales_previstas', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} />
              </div>
            </div>

            {/* Operarios */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Operarios asignados
                </Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addOperario}>
                  <Plus className="w-3 h-3" /> Añadir
                </Button>
              </div>
              {(form.operarios_asignados || []).length === 0 ? (
                <div className="border border-dashed rounded-lg py-4 text-center text-xs text-muted-foreground">
                  Sin operarios asignados
                </div>
              ) : (
                <div className="space-y-2">
                  {(form.operarios_asignados || []).map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <MobileSelect value={op.operario_id} onValueChange={v => updateOp(idx, 'operario_id', v)} placeholder="Operario...">
                          {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                        </MobileSelect>
                        <Input type="number" min="0" placeholder="Horas previstas" value={op.horas_previstas} onChange={e => updateOp(idx, 'horas_previstas', e.target.value)} className="h-9 text-xs" />
                        <Input placeholder="Rol / función (opcional)" value={op.rol} onChange={e => updateOp(idx, 'rol', e.target.value)} className="col-span-2 h-9 text-xs" />
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