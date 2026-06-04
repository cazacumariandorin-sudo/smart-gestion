/**
 * InformeObras — módulo Calendario de Obras
 * Versión 2.0 — según especificación del manual SMART-GESTION julio 2026
 * Ruta: Obras & Proyectos → Informe obras → Calendario
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { addMonths, subMonths } from 'date-fns';
import {
  Plus, Building2, CalendarDays, LayoutList, Loader2, Save, X, Users, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import CalendarioObras from '@/components/informe/CalendarioObras';
import GanttObras from '@/components/informe/GanttObras';
import FiltrosEstadoObra from '@/components/informe/FiltrosEstadoObra';
import PrevisionObraCard from '@/components/informe/PrevisionObraCard';

const STATUS_CFG = {
  planificada: { label: 'Planificada' },
  en_curso:    { label: 'En curso' },
  completada:  { label: 'Completada' },
  cancelada:   { label: 'Cancelada' },
};

const emptyForm = {
  obra_id: '', obra_name: '', client_id: '', client_name: '',
  fecha_inicio: '', fecha_fin: '', horas_totales_previstas: '',
  notas: '', status: 'planificada', operarios_asignados: [],
};

// Vistas disponibles según manual v2.0
const VISTAS = [
  { value: 'calendario', label: 'Vista calendario',    icon: CalendarDays },
  { value: 'por_obra',   label: 'Vista por obra',       icon: LayoutList },
  { value: 'gantt',      label: 'Vista mensual / gantt',icon: Building2 },
];

export default function InformeObras() {
  const qc = useQueryClient();
  const [view, setView] = useState('calendario'); // vista calendario por defecto
  const [month, setMonth] = useState(new Date());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [focusObra, setFocusObra] = useState(null);

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

  // Pull to refresh
  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  // Dialog helpers
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

  const handleMonthChange = (dir) => {
    setMonth(m => dir > 0 ? addMonths(m, 1) : subMonths(m, 1));
  };

  const handleViewChange = (v) => {
    setView(v);
    setViewMenuOpen(false);
  };

  const isPending = createM.isPending || updateM.isPending;
  const currentVista = VISTAS.find(v => v.value === view) || VISTAS[0];
  const CurrentIcon = currentVista.icon;

  // Agrupar previsiones por obra (para vista por obra)
  const grouped = (() => {
    const map = {};
    previsiones.forEach(p => {
      const key = p.obra_name || 'Sin obra';
      if (!map[key]) map[key] = { obraName: key, clientName: p.client_name || '', registros: [] };
      map[key].registros.push(p);
    });
    return Object.values(map).sort((a, b) => a.obraName.localeCompare(b.obraName));
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Calendario de Obras
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Obras & Proyectos → Informe obras</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de vista — esquina superior derecha */}
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => setViewMenuOpen(v => !v)}>
              <CurrentIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{currentVista.label}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
            {viewMenuOpen && (
              <div className="absolute right-0 top-10 z-30 bg-card border border-border rounded-xl shadow-lg overflow-hidden w-52">
                {VISTAS.map(v => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.value}
                      onClick={() => handleViewChange(v.value)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors ${view === v.value ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                    >
                      <Icon className="w-4 h-4" />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button onClick={() => open_()} size="sm" className="gap-1.5 shadow-sm h-9 text-xs">
            <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nueva previsión</span>
          </Button>
        </div>
      </div>

      {/* Filtros desplegables — siempre visibles */}
      <FiltrosEstadoObra obras={obras} />

      {/* ── VISTA CALENDARIO ── */}
      {view === 'calendario' && (
        isLoading ? (
          <div className="h-96 rounded-xl bg-muted animate-pulse" />
        ) : (
          <CalendarioObras
            previsiones={previsiones}
            month={month}
            onMonthChange={handleMonthChange}
            obras={obras}
          />
        )
      )}

      {/* ── VISTA POR OBRA ── */}
      {view === 'por_obra' && (
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

      {/* ── VISTA GANTT ── */}
      {view === 'gantt' && (
        isLoading ? (
          <div className="h-80 rounded-xl bg-muted animate-pulse" />
        ) : (
          <GanttObras
            obras={obras}
            previsiones={previsiones}
            month={month}
            onMonthChange={handleMonthChange}
          />
        )
      )}

      {/* ── Formulario nueva previsión ── */}
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
                <div className="border border-dashed rounded-lg py-4 text-center text-xs text-muted-foreground">Sin operarios asignados</div>
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