import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/lib/useUserRole';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Loader2, Save, Trash2, Check, X, Info, CheckCircle2 } from 'lucide-react';
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
import OperarioDetalleDialog from '@/components/vacaciones/OperarioDetalleDialog';
import AusenciaCard from '@/components/vacaciones/AusenciaCard';
import PanelAprobacionCancelaciones from '@/components/vacaciones/PanelAprobacionCancelaciones';

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
  const { role, user } = useUserRole();
  const isOperarioRole = role === 'operario' || role === 'control_horario' || role === 'técnico';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterOp, setFilterOp] = useState('all');
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('calendario');

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

  // Autoload operario para rol operario/control_horario
  const [myOperario, setMyOperario] = useState(null);
  useEffect(() => {
    if (!user?.email || !isOperarioRole) return;
    base44.entities.Operario.filter({ user_email: user.email }).then(ops => {
      if (ops.length > 0) {
        const op = ops[0];
        setMyOperario(op);
        setForm(p => ({ ...p, operario_id: op.id, operario_name: op.name }));
        setFilterOp(op.id); // Mostrar solo sus vacaciones
      }
    }).catch(() => {});
  }, [user?.email, isOperarioRole]);

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

  // Festivos Comunidad de Madrid 2025-2026
  const festivosMadrid = useMemo(() => {
    const festivos = [
      { fecha: '2025-01-01', nombre: 'Año Nuevo' },
      { fecha: '2025-01-06', nombre: 'Reyes Magos' },
      { fecha: '2025-04-18', nombre: 'Viernes Santo' },
      { fecha: '2025-05-01', nombre: 'Día del Trabajo' },
      { fecha: '2025-05-15', nombre: 'San Isidro Labrador' },
      { fecha: '2025-08-15', nombre: 'Asunción de la Virgen' },
      { fecha: '2025-10-12', nombre: 'Fiesta Nacional de España' },
      { fecha: '2025-11-01', nombre: 'Todos los Santos' },
      { fecha: '2025-12-06', nombre: 'Día de la Constitución' },
      { fecha: '2025-12-25', nombre: 'Natividad del Señor' },
      { fecha: '2026-01-01', nombre: 'Año Nuevo' },
      { fecha: '2026-01-06', nombre: 'Reyes Magos' },
      { fecha: '2026-04-03', nombre: 'Viernes Santo' },
      { fecha: '2026-05-01', nombre: 'Día del Trabajo' },
      { fecha: '2026-05-15', nombre: 'San Isidro Labrador' },
      { fecha: '2026-08-15', nombre: 'Asunción de la Virgen' },
      { fecha: '2026-10-12', nombre: 'Fiesta Nacional de España' },
      { fecha: '2026-11-01', nombre: 'Todos los Santos' },
      { fecha: '2026-12-06', nombre: 'Día de la Constitución' },
      { fecha: '2026-12-25', nombre: 'Natividad del Señor' },
    ];
    return festivos;
  }, []);

  const today = new Date();

  // Días de vacaciones convenio por trabajador (30 días según convenio del metal)
  const diasConvenioPorOperario = useMemo(() => {
    const map = {};
    operarios.forEach(op => {
      // Vacaciones convenio: todos los registros de tipo 'vacaciones_convenio'
      const diasConvenioGozados = vacaciones
        .filter(v => v.operario_id === op.id && v.tipo === 'vacaciones_convenio')
        .reduce((sum, v) => sum + (v.dias || 1), 0);
      
      // Vacaciones normales: solo las que ya han pasado (fecha_fin < hoy)
      const diasVacacionesGozados = vacaciones
        .filter(v => v.operario_id === op.id && v.tipo === 'vacaciones' && parseISO(v.fecha_fin) < today)
        .reduce((sum, v) => sum + (v.dias || 1), 0);
      
      // Baja médica: todos los registros
      const diasBajaMedica = vacaciones
        .filter(v => v.operario_id === op.id && v.tipo === 'baja_medica')
        .reduce((sum, v) => sum + (v.dias || 1), 0);
      
      map[op.id] = {
        operario_id: op.id,
        operario_name: op.name,
        total_derecho: 30,
        dias_convenio_gozados: diasConvenioGozados,
        dias_convenio_pendientes: Math.max(0, 30 - diasConvenioGozados),
        dias_vacaciones_gozados: diasVacacionesGozados,
        dias_baja_medica: diasBajaMedica,
      };
    });
    return Object.values(map);
  }, [operarios, vacaciones]);

  // Summary by operario con cálculo dinámico
  const summaryByOp = useMemo(() => {
    const map = {};
    vacaciones.filter(v => filterOp === 'all' || v.operario_id === filterOp).forEach(v => {
      if (!map[v.operario_id]) map[v.operario_id] = { name: v.operario_name, tipos: {} };
      const tipo = v.tipo;
      
      // Para vacaciones normales: solo contar si la fecha_fin es inferior a hoy
      if (tipo === 'vacaciones' && parseISO(v.fecha_fin) >= today) {
        // No contar vacaciones futuras en el resumen
        return;
      }
      
      map[v.operario_id].tipos[tipo] = (map[v.operario_id].tipos[tipo] || 0) + (v.dias || 1);
    });
    return Object.values(map);
  }, [vacaciones, filterOp]);

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const firstDayOfWeek = (monthDays[0]?.getDay() + 6) % 7; // Monday-based

  const handleDayClick = (day) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedDayEvents(events);
      setDetalleOpen(true);
    }
  };

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
          <TabsTrigger value="festivos">Festivos</TabsTrigger>
          <TabsTrigger value="convenio">Vacaciones Convenio</TabsTrigger>
          <TabsTrigger value="cancelaciones">Cancelaciones</TabsTrigger>
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
                const hasEvents = events.length > 0;
                const dayStr = format(day, 'yyyy-MM-dd');
                const festivo = festivosMadrid.find(f => f.fecha === dayStr);
                const isHoliday = !!festivo;
                const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      'min-h-[70px] rounded-lg p-1.5 border cursor-pointer transition-all hover:shadow-md relative',
                      weekend && !isHoliday ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' : 'bg-background',
                      isHoliday && !weekend ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' : 'border-border',
                      isHoliday && weekend ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' : '',
                      hasEvents && !isHoliday && !weekend && 'ring-2 ring-primary/50',
                      isToday && 'ring-2 ring-emerald-500'
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    {/* Indicador de hoy */}
                    {isToday && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    )}
                    
                    {/* Cabecera del día */}
                    <div className="flex items-center justify-between mb-1">
                      <p className={cn(
                        'text-xs font-bold',
                        isHoliday ? 'text-yellow-700 dark:text-yellow-500' :
                        weekend ? 'text-orange-600 dark:text-orange-400' :
                        'text-foreground'
                      )}>
                        {format(day, 'd')}
                      </p>
                      {isHoliday && (
                        <Badge variant="outline" className="h-4 px-1 text-[8px] bg-yellow-200 text-yellow-800 border-yellow-300">
                          {festivo.nombre.length > 10 ? 'Festivo' : festivo.nombre}
                        </Badge>
                      )}
                      {weekend && !isHoliday && (
                        <span className="text-[9px] text-orange-500 font-medium">FIN</span>
                      )}
                    </div>
                    
                    {/* Eventos */}
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
              {filtered.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)).map(v => (
                <AusenciaCard
                  key={v.id}
                  v={v}
                  onApprove={(id, aprobado) => updateM.mutate({ id, d: { aprobado } })}
                  onDelete={(id) => deleteM.mutate(id)}
                  onEdit={(id, data) => updateM.mutate({ id, d: data })}
                  isOperario={isOperarioRole}
                  currentUser={user}
                />
              ))}
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
            ) : (
              summaryByOp.map(op => (
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
              ))
            )}
          </div>
        </TabsContent>

        {/* FESTIVOS TAB */}
        <TabsContent value="festivos">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Festivos Comunidad de Madrid
              </h3>
              <p className="text-sm text-muted-foreground">Calendario oficial de festivos</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {festivosMadrid.map((festivo, idx) => {
                const fecha = parseISO(festivo.fecha);
                const mesActual = currentDate.getMonth();
                const yearActual = currentDate.getFullYear();
                const festivoMes = fecha.getMonth();
                const festivoYear = fecha.getFullYear();
                
                // Solo mostrar festivos del mes actual o todos si se quiere
                const esDelMesActual = festivoMes === mesActual && festivoYear === yearActual;
                
                return (
                  <Card key={idx} className={cn('p-4 border-l-4 border-primary', !esDelMesActual && 'opacity-50')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{festivo.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(fecha, 'EEEE d MMMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">
                        Festivo
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <Info className="w-3 h-3 inline mr-1" />
                Mostrando festivos de {format(currentDate, 'MMMM yyyy', { locale: es })}. Navega entre meses para ver otros festivos.
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* VACACIONES CONVENIO TAB */}
        <TabsContent value="convenio">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Vacaciones Convenio del Metal
              </h3>
              <p className="text-sm text-muted-foreground">30 días de derecho anual por trabajador</p>
            </div>
            <div className="space-y-3">
              {diasConvenioPorOperario.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No hay operarios registrados</p>
                </div>
              ) : (
                diasConvenioPorOperario.map(op => {
                  const porcentaje = (op.dias_convenio_gozados / op.total_derecho) * 100;
                  return (
                    <Card key={op.operario_id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{op.operario_name}</h4>
                          <Badge className={cn('text-sm', op.dias_convenio_pendientes === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                            {op.dias_convenio_pendientes === 0 ? 'Completado' : `${op.dias_convenio_pendientes} restantes`}
                          </Badge>
                        </div>
                        
                        {/* Vacaciones Convenio */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Vacaciones Convenio</span>
                            <span className="font-medium">{op.dias_convenio_gozados} / {op.total_derecho} días</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${Math.min(100, porcentaje)}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Vacaciones Normales (disfrutadas) */}
                        <div className="flex justify-between text-xs pt-2 border-t">
                          <span className="text-muted-foreground">Vacaciones (disfrutadas)</span>
                          <span className="font-semibold text-blue-600">{op.dias_vacaciones_gozados} días</span>
                        </div>
                        
                        {/* Baja Médica */}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Baja médica</span>
                          <span className="font-semibold text-red-600">{op.dias_baja_medica} días</span>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </Card>
        </TabsContent>

        {/* CANCELACIONES TAB */}
        <TabsContent value="cancelaciones">
          <PanelAprobacionCancelaciones />
        </TabsContent>
      </Tabs>

      {/* Dialog nueva ausencia */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              {isOperarioRole ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {myOperario?.name || user?.full_name || 'Mi perfil'}
                </div>
              ) : (
                <MobileSelect value={form.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                  {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                </MobileSelect>
              )}
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

      {/* Dialog detalle operario */}
      <OperarioDetalleDialog 
        open={detalleOpen} 
        onOpenChange={setDetalleOpen} 
        events={selectedDayEvents} 
      />
    </div>
  );
}