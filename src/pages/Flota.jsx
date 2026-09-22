import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Car, Plus, Edit2, Trash2, Bell, BellOff, AlertTriangle, CheckCircle2, Clock, Wrench, Loader2, ChevronDown, ChevronUp, Route, MapPin, Fuel, Siren, ScrollText } from 'lucide-react';
import ReportarAveriaDialog from '@/components/flota/ReportarAveriaDialog';
import RepostajeRapidoDialog from '@/components/flota/RepostajeRapidoDialog';
import CostesFlotaProyecto from '@/components/flota/CostesFlotaProyecto';
import RepostajesReporte from '@/components/flota/RepostajesReporte';
import MultasPanel from '@/components/flota/multas/MultasPanel';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const EMPTY_FORM = {
  matricula: '', modelo: '', anio: '', color: '', asignado_a: '', notas: '',
  itv_fecha: '',
  neumaticos_km: '', neumaticos_km_cambio: '', neumaticos_fecha_ultimo: '',
  aceite_fecha: '', aceite_km: '',
  filtros_fecha: '', filtros_km: '',
  ac_fecha: '',
  km_actuales: '',
  alertas_email: '', alertas_activas: true,
};

const URGENCIA_COLORS = {
  baja: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
};

const TIPO_ALERTA_LABELS = {
  itv_proxima: 'ITV próxima',
  itv_caducada: 'ITV caducada',
  aceite_km: 'Cambio aceite (km)',
  aceite_fecha: 'Cambio aceite (fecha)',
  neumaticos_km: 'Neumáticos',
  filtros_km: 'Filtros (km)',
  filtros_fecha: 'Filtros (fecha)',
  ac_revision: 'Revisión A/C',
  velocidad_exceso: 'Exceso velocidad',
  mantenimiento_general: 'Mantenimiento',
  averia_motor: 'Avería de motor',
  averia_frenos: 'Avería de frenos',
  averia_electrica: 'Avería eléctrica',
  testigo_panel: 'Testigo en el panel',
  otra_incidencia: 'Otra incidencia',
  repostaje: 'Repostaje combustible',
};

function diasHasta(fechaStr) {
  if (!fechaStr) return null;
  return differenceInDays(parseISO(fechaStr), new Date());
}

function AlertBadge({ dias, label }) {
  if (dias === null) return null;
  if (dias < 0) return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">⛔ {label} vencido</Badge>;
  if (dias <= 1) return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">🔴 {label}: {dias}d</Badge>;
  if (dias <= 5) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">🟠 {label}: {dias}d</Badge>;
  if (dias <= 15) return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">🔵 {label}: {dias}d</Badge>;
  return null;
}

function StatusIcon({ dias }) {
  if (dias === null) return <span className="text-muted-foreground">—</span>;
  if (dias < 0) return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (dias <= 5) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  if (dias <= 15) return <Clock className="w-4 h-4 text-blue-500" />;
  return <CheckCircle2 className="w-4 h-4 text-green-500" />;
}

function DetailItem({ icon, label, value, dias }) {
  const color = dias !== undefined && dias !== null ? (dias < 0 ? 'text-red-600' : dias <= 5 ? 'text-amber-600' : dias <= 15 ? 'text-blue-600' : 'text-foreground') : 'text-foreground';
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{value}</p>
        {dias !== undefined && dias !== null && dias >= 0 && <p className="text-xs text-muted-foreground">{dias}d restantes</p>}
        {dias !== undefined && dias !== null && dias < 0 && <p className="text-xs text-red-500">Vencido hace {Math.abs(dias)}d</p>}
      </div>
    </div>
  );
}

function FormField({ label, id, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function VehiculoCard({ v, onEdit, onDelete, isAdmin, onReportarAveria, onRepostaje }) {
  const [expanded, setExpanded] = useState(false);
  const itvDias = diasHasta(v.itv_fecha);
  const aceiteDias = diasHasta(v.aceite_fecha);
  const filtrosDias = diasHasta(v.filtros_fecha);
  const acDias = diasHasta(v.ac_fecha);
  const alertas = [itvDias, aceiteDias, filtrosDias, acDias].filter(d => d !== null && d <= 15);
  const critico = alertas.some(d => d <= 5);
  const advertencia = !critico && alertas.length > 0;

  return (
    <Card className={`p-4 transition-all ${critico ? 'border-red-300 bg-red-50/30 dark:bg-red-950/20' : advertencia ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${critico ? 'bg-red-100 text-red-600' : advertencia ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
            <Car className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-widest">{v.matricula}</span>
              <span className="text-sm text-muted-foreground">{v.modelo}</span>
              {v.anio && <Badge variant="outline" className="text-xs">{v.anio}</Badge>}
              {v.asignado_a && <Badge variant="secondary" className="text-xs">👤 {v.asignado_a}</Badge>}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <AlertBadge dias={itvDias} label="ITV" />
              <AlertBadge dias={aceiteDias} label="Aceite" />
              <AlertBadge dias={filtrosDias} label="Filtros" />
              <AlertBadge dias={acDias} label="A/C" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="Registrar repostaje" onClick={() => onRepostaje(v)}>
            <Fuel className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-500 hover:text-orange-600" title="Reportar avería" onClick={() => onReportarAveria(v)}>
            <Siren className="w-4 h-4" />
          </Button>
          {v.alertas_activas ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          {isAdmin && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => onEdit(v)}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará {v.matricula} — {v.modelo}.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(v.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailItem icon={<StatusIcon dias={itvDias} />} label="ITV" value={v.itv_fecha ? format(parseISO(v.itv_fecha), 'dd/MM/yyyy') : '—'} dias={itvDias} />
          <DetailItem icon={<Wrench className="w-4 h-4 text-muted-foreground" />} label="Aceite" value={v.aceite_fecha ? format(parseISO(v.aceite_fecha), 'dd/MM/yyyy') : '—'} dias={aceiteDias} />
          <DetailItem icon={<Wrench className="w-4 h-4 text-muted-foreground" />} label="Filtros" value={v.filtros_fecha ? format(parseISO(v.filtros_fecha), 'dd/MM/yyyy') : '—'} dias={filtrosDias} />
          <DetailItem icon={<Wrench className="w-4 h-4 text-muted-foreground" />} label="A/C" value={v.ac_fecha ? format(parseISO(v.ac_fecha), 'dd/MM/yyyy') : '—'} dias={acDias} />
          {v.km_actuales && <DetailItem icon={<Car className="w-4 h-4 text-muted-foreground" />} label="Km actuales" value={`${Number(v.km_actuales).toLocaleString('es-ES')} km`} />}
          {v.neumaticos_km_cambio && <DetailItem icon={<Car className="w-4 h-4 text-muted-foreground" />} label="Km cambio neumáticos" value={`${Number(v.neumaticos_km_cambio).toLocaleString('es-ES')} km`} />}
          {v.alertas_email && <div className="col-span-2 sm:col-span-4"><p className="text-xs text-muted-foreground">📧 Alertas: {v.alertas_email}</p></div>}
        </div>
      )}
    </Card>
  );
}

export default function Flota() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();
  const puedeGestionarFlota = isAdmin || isGerencia || isAdministracion;
  const [flotaTab, setFlotaTab] = useState('vehiculos');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [averiaVehiculo, setAveriaVehiculo] = useState(null);
  const [repostajeVehiculo, setRepostajeVehiculo] = useState(null);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['vehiculos'] });
    qc.invalidateQueries({ queryKey: ['viajes'] });
    qc.invalidateQueries({ queryKey: ['alertas-vehiculo'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: vehiculos = [], isLoading } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: () => base44.entities.Vehiculo.list('matricula', 200),
  });

  const { data: viajes = [] } = useQuery({
    queryKey: ['viajes'],
    queryFn: () => base44.entities.ViajeVehiculo.list('-fecha', 100),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-vehiculo'],
    queryFn: () => base44.entities.AlertaVehiculo.list('-fecha', 100),
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: (id) => base44.entities.AlertaVehiculo.update(id, { resuelta: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas-vehiculo'] }),
  });

  const reportarAveriaMutation = useMutation({
    mutationFn: async ({ tipo, urgencia, descripcion }) => {
      const v = averiaVehiculo;
      await base44.entities.AlertaVehiculo.create({
        vehiculo_id: v.id,
        vehiculo_matricula: v.matricula,
        vehiculo_modelo: v.modelo,
        tipo,
        urgencia,
        descripcion,
        fecha: new Date().toISOString().split('T')[0],
        km_actuales: v.km_actuales || undefined,
        reportada_por_nombre: user?.full_name || user?.email || '',
      });
      await base44.entities.AsistenteTarea.create({
        titulo: `Avería reportada — ${v.matricula} (${v.modelo})`,
        descripcion,
        tipo: 'alerta',
        prioridad: urgencia === 'critica' ? 'urgente' : urgencia === 'alta' ? 'alta' : urgencia === 'media' ? 'media' : 'baja',
        entidad_relacionada_tipo: 'Vehiculo',
        entidad_relacionada_id: v.id,
        creada_por: 'usuario',
        solo_gerencia: true,
        modulo: 'flota',
        origen_solicitud: user?.full_name || user?.email || '',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas-vehiculo'] });
      setAveriaVehiculo(null);
      toast.success('Avería reportada. Gerencia y administración han sido avisadas.');
    },
    onError: () => toast.error('Error al reportar la avería'),
  });

  const setF = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

  const saveMutation = useOptimisticMutation(
    async (data) => {
      if (editing) return base44.entities.Vehiculo.update(editing.id, data);
      return base44.entities.Vehiculo.create(data);
    },
    'vehiculos',
    (prev, data) => editing
      ? prev.map(v => v.id === editing.id ? { ...v, ...data } : v)
      : [...prev, { ...data, id: `temp_${Date.now()}` }],
    () => { setOpen(false); setEditing(null); setForm(EMPTY_FORM); toast.success(editing ? 'Vehículo actualizado' : 'Vehículo creado'); },
    () => toast.error('Error al guardar')
  );

  const deleteMutation = useOptimisticMutation(
    (id) => base44.entities.Vehiculo.delete(id),
    'vehiculos',
    (prev, id) => prev.filter(v => v.id !== id),
    () => toast.success('Vehículo eliminado'),
    () => toast.error('Error al eliminar')
  );

  const repostajeMutation = useMutation({
    mutationFn: async (lugar) => {
      const v = repostajeVehiculo;
      const tecnico = user?.full_name || user?.email || '';
      await base44.entities.AlertaVehiculo.create({
        vehiculo_id: v.id,
        vehiculo_matricula: v.matricula,
        vehiculo_modelo: v.modelo,
        tipo: 'repostaje',
        urgencia: 'baja',
        avisos_visible: true,
        lugar,
        descripcion: `Suministro de combustible registrado por ${tecnico}`,
        reportada_por_nombre: tecnico,
        fecha: new Date().toISOString().split('T')[0],
        km_actuales: v.km_actuales || undefined,
      });
      await base44.entities.AsistenteTarea.create({
        titulo: `Repostaje — ${v.matricula} (${v.modelo})`,
        descripcion: `${tecnico} repostó combustible en: ${lugar}`,
        tipo: 'alerta',
        prioridad: 'baja',
        entidad_relacionada_tipo: 'Vehiculo',
        entidad_relacionada_id: v.id,
        creada_por: 'usuario',
        solo_gerencia: true,
        modulo: 'flota',
        origen_solicitud: tecnico,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas-vehiculo'] });
      setRepostajeVehiculo(null);
      toast.success('Repostaje registrado. Gerencia y administración avisadas.');
    },
    onError: () => toast.error('Error al registrar el repostaje'),
  });

  const handleEdit = (v) => {
    setEditing(v);
    setForm({
      matricula: v.matricula || '', modelo: v.modelo || '', anio: v.anio || '', color: v.color || '',
      asignado_a: v.asignado_a || '', notas: v.notas || '',
      itv_fecha: v.itv_fecha || '',
      neumaticos_km: v.neumaticos_km || '', neumaticos_km_cambio: v.neumaticos_km_cambio || '',
      neumaticos_fecha_ultimo: v.neumaticos_fecha_ultimo || '',
      aceite_fecha: v.aceite_fecha || '', aceite_km: v.aceite_km || '',
      filtros_fecha: v.filtros_fecha || '', filtros_km: v.filtros_km || '',
      ac_fecha: v.ac_fecha || '',
      km_actuales: v.km_actuales || '',
      alertas_email: v.alertas_email || '', alertas_activas: v.alertas_activas !== false,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.matricula || !form.modelo) { toast.error('Matrícula y modelo son obligatorios'); return; }
    const data = { ...form };
    ['anio', 'neumaticos_km', 'neumaticos_km_cambio', 'aceite_km', 'filtros_km', 'km_actuales'].forEach(k => {
      if (data[k] !== '' && data[k] !== undefined) data[k] = Number(data[k]);
      else delete data[k];
    });
    saveMutation.mutate(data);
  };

  // Los repostajes archivados (avisos_visible=false) desaparecen del tab de avisos
  // para todos; solo gerencia/admin los ven vía el reporte de repostajes.
  const alertasPendientes = alertas.filter(a => !a.resuelta && (a.tipo !== 'repostaje' || a.avisos_visible !== false));
  const alertasResueltas = alertas.filter(a => a.resuelta);

  const alertasUrgentes = vehiculos.filter(v => {
    const checks = [v.itv_fecha, v.aceite_fecha, v.filtros_fecha, v.ac_fecha];
    return checks.some(f => { const d = diasHasta(f); return d !== null && d <= 5; });
  }).length;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Flota"
        subtitle={`${vehiculos.length} vehículo${vehiculos.length !== 1 ? 's' : ''}${alertasUrgentes > 0 ? ` · ${alertasUrgentes} con alertas urgentes` : ''}${alertasPendientes.length > 0 ? ` · ${alertasPendientes.length} alertas pendientes` : ''}`}
        hideBack={true}
        actions={puedeGestionarFlota ? (
          <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); }} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Añadir vehículo
          </Button>
        ) : undefined}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={flotaTab} onValueChange={setFlotaTab}>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { value: 'vehiculos', label: `Vehículos (${vehiculos.length})`, icon: Car,   color: 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-blue-200' },
              { value: 'viajes',    label: `Viajes (${viajes.length})`,       icon: Route, color: 'bg-teal-500 hover:bg-teal-600 border-teal-600 shadow-teal-200' },
              { value: 'alertas',   label: alertasPendientes.length > 0 ? `Alertas (${alertasPendientes.length})` : 'Alertas', icon: Bell,  color: alertasPendientes.length > 0 ? 'bg-red-500 hover:bg-red-600 border-red-600 shadow-red-200' : 'bg-slate-500 hover:bg-slate-600 border-slate-600 shadow-slate-200' },
              ...(puedeGestionarFlota ? [{ value: 'costes', label: 'Costes por proyecto', icon: Fuel, color: 'bg-amber-500 hover:bg-amber-600 border-amber-600 shadow-amber-200' }] : []),
              ...(puedeGestionarFlota ? [{ value: 'repostajes', label: 'Repostajes', icon: Fuel, color: 'bg-green-500 hover:bg-green-600 border-green-600 shadow-green-200' }] : []),
              { value: 'multas', label: 'Multas', icon: ScrollText, color: 'bg-rose-500 hover:bg-rose-600 border-rose-600 shadow-rose-200' },
            ].map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setFlotaTab(value)}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm text-white shadow-md',
                  'transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95',
                  color,
                  flotaTab === value ? 'ring-2 ring-offset-2 ring-current scale-105 shadow-lg' : 'opacity-80',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <TabsList className="hidden">
            <TabsTrigger value="vehiculos" />
            <TabsTrigger value="viajes" />
            <TabsTrigger value="alertas" />
            <TabsTrigger value="costes" />
            <TabsTrigger value="repostajes" />
            <TabsTrigger value="multas" />
          </TabsList>

          {/* TAB VEHÍCULOS */}
          <TabsContent value="vehiculos">
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Vencido/≤5d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> 6-15 días</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> ≤15 días</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> OK</span>
            </div>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : vehiculos.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-xl">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No hay vehículos registrados</p>
                {puedeGestionarFlota && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Añadir vehículo</Button>}
              </div>
            ) : (
              <div className="space-y-3">
                {vehiculos.map(v => (
                  <VehiculoCard key={v.id} v={v} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isAdmin={isAdmin} onReportarAveria={setAveriaVehiculo} onRepostaje={setRepostajeVehiculo} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB VIAJES */}
          <TabsContent value="viajes">
            <div className="space-y-2">
              {viajes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Route className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No hay viajes registrados</p>
                </div>
              )}
              {viajes.map(v => (
                <Card key={v.id} className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Car className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{v.vehiculo_matricula}</p>
                        <p className="text-xs text-muted-foreground">{v.operario_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {v.fecha && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(v.fecha), 'dd MMM yyyy', { locale: es })}</span>}
                      {v.distancia_km && <span className="flex items-center gap-1"><Route className="w-3 h-3" />{v.distancia_km} km</span>}
                      {v.coste_combustible_estimado && <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{v.coste_combustible_estimado.toFixed(2)} €</span>}
                    </div>
                  </div>
                  {(v.inicio_direccion || v.fin_direccion) && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0 text-primary" />
                      <span>{v.inicio_direccion}</span>
                      {v.fin_direccion && <><span>→</span><span>{v.fin_direccion}</span></>}
                    </div>
                  )}
                  {v.proyecto_nombre && <p className="mt-1 text-xs text-primary font-medium pl-5">📁 {v.proyecto_nombre}</p>}
                  {v.validado && <Badge className="mt-2 bg-green-100 text-green-700 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Validado</Badge>}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB ALERTAS */}
          <TabsContent value="alertas">
            {alertasPendientes.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pendientes</h3>
                <div className="space-y-2">
                  {alertasPendientes.map(a => (
                    <Card key={a.id} className="p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={cn('w-5 h-5', a.urgencia === 'critica' || a.urgencia === 'alta' ? 'text-red-500' : 'text-yellow-500')} />
                          <div>
                            <p className="font-medium text-sm">{TIPO_ALERTA_LABELS[a.tipo] || a.tipo}</p>
                            <p className="text-xs text-muted-foreground">{a.vehiculo_matricula} {a.vehiculo_modelo && `— ${a.vehiculo_modelo}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.lugar && <Badge variant="outline" className="text-xs gap-1"><MapPin className="w-3 h-3" />{a.lugar}</Badge>}
                          <Badge className={cn('text-xs', URGENCIA_COLORS[a.urgencia])}>{a.urgencia}</Badge>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolverAlertaMutation.mutate(a.id)}>
                            Resolver
                          </Button>
                        </div>
                      </div>
                      {a.descripcion && <p className="text-xs text-muted-foreground mt-1.5 pl-8">{a.descripcion}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {alertasResueltas.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resueltas</h3>
                <div className="space-y-2">
                  {alertasResueltas.map(a => (
                    <Card key={a.id} className="p-3 opacity-60">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-sm">{TIPO_ALERTA_LABELS[a.tipo] || a.tipo}</p>
                          <p className="text-xs text-muted-foreground">{a.vehiculo_matricula}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {alertas.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No hay alertas</p>
              </div>
            )}
          </TabsContent>

          {/* TAB COSTES POR PROYECTO */}
          {puedeGestionarFlota && (
            <TabsContent value="costes">
              <CostesFlotaProyecto viajes={viajes} />
            </TabsContent>
          )}

          {/* TAB REPOSTAJES (reporte histórico gerencia/admin) */}
          {puedeGestionarFlota && (
            <TabsContent value="repostajes">
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">
                  Registro de repostajes. Los avisos del día son visibles para todos los usuarios; al archivarse a las 23:59 quedan como histórico accesible solo para gerencia y administración.
                </p>
              </div>
              <RepostajesReporte />
            </TabsContent>
          )}

          {/* TAB MULTAS */}
          <TabsContent value="multas">
            <MultasPanel vehiculos={vehiculos} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null); setForm(EMPTY_FORM); } else setOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar — ${editing.matricula}` : 'Nuevo vehículo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Datos del vehículo</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Matrícula *" id="matricula" value={form.matricula} onChange={setF('matricula')} placeholder="1234 ABC" />
                <FormField label="Modelo *" id="modelo" value={form.modelo} onChange={setF('modelo')} placeholder="Ford Transit" />
                <FormField label="Año" id="anio" type="number" value={form.anio} onChange={setF('anio')} placeholder="2020" />
                <FormField label="Color" id="color" value={form.color} onChange={setF('color')} placeholder="Blanco" />
                <div className="col-span-2">
                  <FormField label="Asignado a" id="asignado_a" value={form.asignado_a} onChange={setF('asignado_a')} placeholder="Nombre del conductor" />
                </div>
                <div className="col-span-2">
                  <FormField label="Km actuales" id="km_actuales" type="number" value={form.km_actuales} onChange={setF('km_actuales')} placeholder="125000" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📋 ITV</p>
              <FormField label="Fecha caducidad ITV" id="itv_fecha" type="date" value={form.itv_fecha} onChange={setF('itv_fecha')} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🚗 Neumáticos</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fecha último cambio" id="neumaticos_fecha_ultimo" type="date" value={form.neumaticos_fecha_ultimo} onChange={setF('neumaticos_fecha_ultimo')} />
                <FormField label="Km en último cambio" id="neumaticos_km" type="number" value={form.neumaticos_km} onChange={setF('neumaticos_km')} placeholder="100000" />
                <div className="col-span-2">
                  <FormField label="Km para próximo cambio" id="neumaticos_km_cambio" type="number" value={form.neumaticos_km_cambio} onChange={setF('neumaticos_km_cambio')} placeholder="140000" hint="Km totales en los que se debe realizar el próximo cambio" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🔧 Revisión mecánica</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fecha cambio aceite" id="aceite_fecha" type="date" value={form.aceite_fecha} onChange={setF('aceite_fecha')} />
                <FormField label="Km cambio aceite" id="aceite_km" type="number" value={form.aceite_km} onChange={setF('aceite_km')} placeholder="130000" />
                <FormField label="Fecha cambio filtros" id="filtros_fecha" type="date" value={form.filtros_fecha} onChange={setF('filtros_fecha')} />
                <FormField label="Km cambio filtros" id="filtros_km" type="number" value={form.filtros_km} onChange={setF('filtros_km')} placeholder="130000" />
                <div className="col-span-2">
                  <FormField label="Fecha revisión A/C" id="ac_fecha" type="date" value={form.ac_fecha} onChange={setF('ac_fecha')} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🔔 Alertas por email</p>
              <div className="space-y-3">
                <FormField
                  label="Emails (separados por coma)"
                  id="alertas_email"
                  value={form.alertas_email}
                  onChange={setF('alertas_email')}
                  placeholder="admin@empresa.com, otro@empresa.com"
                  hint="Se enviarán alertas 15, 5 y 1 día antes de cada caducidad"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="alertas_activas"
                    checked={form.alertas_activas}
                    onChange={e => setF('alertas_activas')(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="alertas_activas" className="text-sm cursor-pointer">Alertas activas</Label>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas adicionales</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[70px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.notas}
                onChange={e => setF('notas')(e.target.value)}
                placeholder="Observaciones..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); setForm(EMPTY_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? 'Guardar cambios' : 'Crear vehículo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportarAveriaDialog
        vehiculo={averiaVehiculo}
        open={!!averiaVehiculo}
        onOpenChange={(o) => { if (!o) setAveriaVehiculo(null); }}
        onSubmit={(data) => reportarAveriaMutation.mutate(data)}
        isSubmitting={reportarAveriaMutation.isPending}
      />

      <RepostajeRapidoDialog
        vehiculo={repostajeVehiculo}
        open={!!repostajeVehiculo}
        onOpenChange={(o) => { if (!o) setRepostajeVehiculo(null); }}
        onSubmit={(lugar) => repostajeMutation.mutate(lugar)}
        isSubmitting={repostajeMutation.isPending}
        tecnicoNombre={user?.full_name || user?.email}
      />
    </div>
  );
}