import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Loader2, Save, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const TIPOS = [
  { key: 'vacaciones', label: 'Vacaciones', color: 'bg-blue-500', light: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'baja_medica', label: 'Baja médica', color: 'bg-red-500', light: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'dia_asunto_personal', label: 'Asunto personal', color: 'bg-purple-500', light: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'fiesta', label: 'Fiesta / festivo', color: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'vacaciones_convenio', label: 'Vacaciones convenio', color: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

const tipoCfg = Object.fromEntries(TIPOS.map(t => [t.key, t]));

const emptyForm = {
  operario_id: '', operario_name: '', fecha_inicio: '', fecha_fin: '',
  tipo: 'vacaciones', notas: '', aprobado: false,
};

export default function CalendarioVacaciones() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterOp, setFilterOp] = useState('all');

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['vacaciones'] });
    qc.invalidateQueries({ queryKey: ['operarios'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: vacaciones = [], isLoading } = useQuery({
    queryKey: ['vacaciones'],
    queryFn: () => base44.entities.Vacacion.list('-fecha_inicio', 500),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const createM = useOptimisticMutation(
    d => base44.entities.Vacacion.create(d),
    'vacaciones',
    (prev, d) => [...prev, { ...d, id: `temp_${Date.now()}` }],
    () => { setDialogOpen(false); setForm(emptyForm); }
  );
  const deleteM = useOptimisticMutation(
    id => base44.entities.Vacacion.delete(id),
    'vacaciones',
    (prev, id) => prev.filter(v => v.id !== id)
  );
  const updateM = useOptimisticMutation(
    ({ id, d }) => base44.entities.Vacacion.update(id, d),
    'vacaciones',
    (prev, { id, d }) => prev.map(v => v.id === id ? { ...v, ...d } : v)
  );

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOpChange = (id) => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const calcDias = (inicio, fin) => {
    if (!inicio || !fin) return 1;
    return Math.max(1, differenceInDays(parseISO(fin), parseISO(inicio)) + 1);
  };

  const handleSave = () => {
    const dias = calcDias(form.fecha_inicio, form.fecha_fin || form.fecha_inicio);
    createM.mutate({ ...form, fecha_fin: form.fecha_fin || form.fecha_inicio, dias });
  };

  // Calendar days for current month
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filter vacaciones
  const filtered = useMemo(() => {
    return vacaciones.filter(v => filterOp === 'all' || v.operario_id === filterOp);
  }, [vacaciones, filterOp]);

  // Get events for a specific day
  const getEventsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return filtered.filter(v => {
      const start = v.fecha_inicio;
      const end = v.fecha_fin || v.fecha_inicio;
      return dayStr >= start && dayStr <= end;
    });
  };

  // Summary by operario
  const summaryByOp = useMemo(() => {
    const map = {};
    vacaciones.filter(v => filterOp === 'all' || v.operario_id === filterOp).forEach(v => {
      if (!map[v.operario_id]) map[v.operario_id] = { name: v.operario_name, tipos: {} };
      const tipo = v.tipo;
      map[v.operario_id].tipos[tipo] = (map[v.operario_id].tipos[tipo] || 0) + (v.dias || 1);
    });
    return Object.values(map);
  }, [vacaciones, filterOp]);

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const firstDayOfWeek = (monthDays[0]?.getDay() + 6) % 7; // Monday-based

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" /> Calendario Vacaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de ausencias y vacaciones</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Registrar Ausencia</span>
        </Button>
      </div>

      {/* Leyenda tipos */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TIPOS.map(t => (
          <Badge key={t.key} variant="outline" className={t.light + ' text-xs'}>{t.label}</Badge>
        ))}
      </div>

      {/* Filtro operario */}
      <div className="flex gap-3 mb-5">
        <MobileSelect value={filterOp} onValueChange={setFilterOp} placeholder="Todos los operarios" triggerClassName="w-52">
          <MobileSelectItem value="all">Todos los operarios</MobileSelectItem>
          {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList className="mb-4">
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendario">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
              <h2 className="font-semibold text-lg capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </h2>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
              {monthDays.map(day => {
                const events = getEventsForDay(day);
                const weekend = isWeekend(day);
                return (
                  <div key={day.toISOString()} className={cn('min-h-[60px] rounded-lg p-1 border', weekend ? 'bg-muted/30' : 'bg-background', 'border-border')}>
                    <p className={cn('text-xs font-medium mb-1', weekend ? 'text-muted-foreground' : '')}>
                      {format(day, 'd')}
                    </p>
                    <div className="space-y-0.5">
                      {events.slice(0, 2).map((ev, idx) => {
                        const cfg = tipoCfg[ev.tipo];
                        return (
                          <div key={idx} className={cn('text-[9px] rounded px-1 py-0.5 truncate font-medium', cfg?.color || 'bg-primary', 'text-white')}>
                            {ev.operario_name?.split(' ')[0]}
                          </div>
                        );
                      })}
                      {events.length > 2 && <div className="text-[9px] text-muted-foreground">+{events.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* LIST VIEW */}
        <TabsContent value="lista">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-xl">
              <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay ausencias registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)).map(v => {
                const cfg = tipoCfg[v.tipo];
                return (
                  <Card key={v.id} className="p-4 flex items-center gap-4">
                    <div className={cn('w-3 h-3 rounded-full shrink-0', cfg?.color || 'bg-primary')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{v.operario_name}</span>
                        <Badge variant="outline" className={cn('text-[10px]', cfg?.light)}>{cfg?.label || v.tipo}</Badge>
                        {v.aprobado && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Aprobado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.fecha_inicio} {v.fecha_fin && v.fecha_fin !== v.fecha_inicio ? `→ ${v.fecha_fin}` : ''} · {v.dias || 1} día(s)
                      </p>
                      {v.notas && <p className="text-xs text-muted-foreground truncate">{v.notas}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => updateM.mutate({ id: v.id, d: { aprobado: !v.aprobado } })}>
                        {v.aprobado ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteM.mutate(v.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* SUMMARY VIEW */}
        <TabsContent value="resumen">
          <div className="space-y-4">
            {summaryByOp.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </div>
            ) : summaryByOp.map(op => (
              <Card key={op.name} className="p-4">
                <h3 className="font-semibold mb-3">{op.name}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {TIPOS.map(t => {
                    const dias = op.tipos[t.key] || 0;
                    return (
                      <div key={t.key} className={cn('rounded-lg p-3 text-center border', t.light)}>
                        <p className="text-[10px] font-medium mb-1">{t.label}</p>
                        <p className="text-xl font-bold">{dias}</p>
                        <p className="text-[10px]">días</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">Total días disfrutados</span>
                  <span className="font-bold text-primary">{Object.values(op.tipos).reduce((s, v) => s + v, 0)} días</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog nueva ausencia */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              <MobileSelect value={form.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo *</Label>
              <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo de ausencia">
                {TIPOS.map(t => <MobileSelectItem key={t.key} value={t.key}>{t.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha inicio *</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha fin</Label>
                <Input type="date" value={form.fecha_fin} min={form.fecha_inicio || undefined} onChange={e => {
                  if (form.fecha_inicio && e.target.value < form.fecha_inicio) return;
                  set('fecha_fin', e.target.value);
                }} />
                {form.fecha_fin && form.fecha_inicio && form.fecha_fin < form.fecha_inicio && (
                  <p className="text-xs text-destructive">La fecha fin no puede ser anterior a la fecha inicio</p>
                )}
              </div>
            </div>
            {form.fecha_inicio && (
              <p className="text-xs text-muted-foreground">
                Días: {calcDias(form.fecha_inicio, form.fecha_fin || form.fecha_inicio)}
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.operario_id || !form.fecha_inicio || createM.isPending} className="gap-2 min-w-28">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}