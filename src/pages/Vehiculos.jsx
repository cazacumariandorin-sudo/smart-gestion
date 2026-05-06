import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Car, Plus, Edit2, Trash2, Bell, BellOff, AlertTriangle, CheckCircle2, Clock, Wrench, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';

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

function VehiculoCard({ v, onEdit, onDelete, isAdmin }) {
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
            {/* Alert badges */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <AlertBadge dias={itvDias} label="ITV" />
              <AlertBadge dias={aceiteDias} label="Aceite" />
              <AlertBadge dias={filtrosDias} label="Filtros" />
              <AlertBadge dias={acDias} label="A/C" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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

      {/* Expanded detail */}
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

export default function Vehiculos() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testando, setTestando] = useState(false);

  const onRefresh = useCallback(() => qc.invalidateQueries({ queryKey: ['vehiculos'] }), [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: vehiculos = [], isLoading } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: () => base44.entities.Vehiculo.list('matricula', 200),
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
    () => {
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? 'Vehículo actualizado' : 'Vehículo creado');
    },
    () => toast.error('Error al guardar')
  );

  const deleteMutation = useOptimisticMutation(
    (id) => base44.entities.Vehiculo.delete(id),
    'vehiculos',
    (prev, id) => prev.filter(v => v.id !== id),
    () => toast.success('Vehículo eliminado'),
    () => toast.error('Error al eliminar')
  );

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

  const handleTestAlertas = async () => {
    setTestando(true);
    try {
      const res = await base44.functions.invoke('alertasVehiculos', {});
      toast.success(`Alertas enviadas: ${res.data?.alertas_enviadas ?? 0}`);
    } catch { toast.error('Error al enviar alertas'); }
    finally { setTestando(false); }
  };

  // Summary stats
  const alertasUrgentes = vehiculos.filter(v => {
    const checks = [v.itv_fecha, v.aceite_fecha, v.filtros_fecha, v.ac_fecha];
    return checks.some(f => { const d = diasHasta(f); return d !== null && d <= 5; });
  }).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Car className="w-7 h-7 text-primary" /> Vehículos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''}
            {alertasUrgentes > 0 && <span className="ml-2 text-red-600 font-semibold">· {alertasUrgentes} con alertas urgentes</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={handleTestAlertas} disabled={testando} className="gap-2">
                {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                <span className="hidden sm:inline">Enviar alertas</span>
              </Button>
              <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> Añadir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Vencido/≤5d</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> 6-15 días</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> ≤15 días</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> OK</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : vehiculos.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No hay vehículos registrados</p>
          {isAdmin && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Añadir vehículo</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {vehiculos.map(v => (
            <VehiculoCard key={v.id} v={v} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null); setForm(EMPTY_FORM); } else setOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar — ${editing.matricula}` : 'Nuevo vehículo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Datos básicos */}
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

            {/* ITV */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📋 ITV</p>
              <FormField label="Fecha caducidad ITV" id="itv_fecha" type="date" value={form.itv_fecha} onChange={setF('itv_fecha')} />
            </div>

            {/* Neumáticos */}
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

            {/* Revisión mecánica */}
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

            {/* Alertas */}
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

            {/* Notas */}
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
    </div>
  );
}