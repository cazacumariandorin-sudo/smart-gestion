import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DIAS_SEMANA, DIAS_FULL } from '@/lib/horasUtils';
import { playAlarmSound, requestNotificationPermission, getNotificationPermission } from '@/hooks/useAlarmas';
import { Plus, Trash2, Bell, BellOff, Save, Loader2, Volume2, SmartphoneNfc, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

const TIPOS = [
  { key: 'entrada', label: 'Entrada', color: 'bg-green-100 text-green-700' },
  { key: 'salida', label: 'Salida', color: 'bg-red-100 text-red-700' },
  { key: 'pausa_inicio', label: 'Inicio Pausa', color: 'bg-amber-100 text-amber-700' },
  { key: 'pausa_fin', label: 'Fin Pausa', color: 'bg-blue-100 text-blue-700' },
];

// Preset 5+2 (Mon-Fri)
const PRESET_5_2 = [0, 1, 2, 3, 4];

const emptyAlarm = { nombre: '', hora: '08:00', tipo: 'entrada', dias: PRESET_5_2, activa: true };

export default function AlarmasTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyAlarm);
  const [notifStatus, setNotifStatus] = useState(() => getNotificationPermission());
  const [requesting, setRequesting] = useState(false);

  const { data: alarmas = [], isLoading } = useQuery({ queryKey: ['alarmas'], queryFn: () => base44.entities.AlarmaHorario.list('hora', 100) });

  const createM = useMutation({ mutationFn: d => base44.entities.AlarmaHorario.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['alarmas'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.AlarmaHorario.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['alarmas'] }) });
  const deleteM = useMutation({ mutationFn: id => base44.entities.AlarmaHorario.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['alarmas'] }) });

  const close_ = () => { setDialogOpen(false); setForm(emptyAlarm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleDia = (idx) => {
    setForm(p => ({
      ...p,
      dias: p.dias.includes(idx) ? p.dias.filter(d => d !== idx) : [...p.dias, idx].sort()
    }));
  };

  const setPreset = (preset) => {
    if (preset === '52') setForm(p => ({ ...p, dias: [0, 1, 2, 3, 4] }));
    else if (preset === '6') setForm(p => ({ ...p, dias: [0, 1, 2, 3, 4, 5] }));
    else if (preset === 'todos') setForm(p => ({ ...p, dias: [0, 1, 2, 3, 4, 5, 6] }));
  };

  const requestNotif = async () => {
    setRequesting(true);
    const perm = await requestNotificationPermission();
    setNotifStatus(perm);
    setRequesting(false);
  };

  const handleSave = () => {
    createM.mutate(form);
  };

  const toggleActiva = (alarm) => {
    updateM.mutate({ id: alarm.id, d: { ...alarm, activa: !alarm.activa } });
  };

  const tipoCfg = (t) => TIPOS.find(x => x.key === t) || TIPOS[0];

  return (
    <div>
      {/* Notification permission banner */}
      {notifStatus === 'unavailable' && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Notificaciones no disponibles</p>
            <p className="text-xs text-slate-500">Tu navegador no soporta notificaciones. En iOS, instala la app en la pantalla de inicio (Añadir a pantalla de inicio) para activarlas.</p>
          </div>
        </div>
      )}

      {notifStatus === 'default' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <SmartphoneNfc className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Activa las notificaciones push</p>
              <p className="text-xs text-amber-700 mt-0.5">Recibirás alertas sonoras y en pantalla cuando llegue la hora de la alarma, incluso si tienes el teléfono bloqueado.</p>
            </div>
          </div>
          <Button size="sm" onClick={requestNotif} disabled={requesting}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 gap-1.5">
            {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            Activar
          </Button>
        </div>
      )}

      {notifStatus === 'denied' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Notificaciones bloqueadas</p>
            <p className="text-xs text-red-600 mt-0.5">
              Has bloqueado las notificaciones. Para activarlas ve a <strong>Ajustes → Privacidad → Notificaciones</strong> y permite esta app. En iOS reinstala desde Safari usando "Añadir a pantalla de inicio".
            </p>
          </div>
        </div>
      )}

      {notifStatus === 'granted' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-700 font-medium">Notificaciones push activadas · Las alarmas se mostrarán en pantalla y reproducirán sonido.</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{alarmas.length} alarmas configuradas</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={playAlarmSound} className="gap-2">
            <Volume2 className="w-3.5 h-3.5" /> Probar sonido
          </Button>
          <Button onClick={() => { setForm(emptyAlarm); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva Alarma
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : alarmas.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay alarmas configuradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alarmas.sort((a, b) => a.hora > b.hora ? 1 : -1).map(alarm => {
            const tipo = tipoCfg(alarm.tipo);
            return (
              <Card key={alarm.id} className={`p-4 flex items-center gap-4 transition-opacity ${alarm.activa ? '' : 'opacity-50'}`}>
                <div className="text-2xl font-bold w-20 shrink-0 text-center text-primary">{alarm.hora}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{alarm.nombre}</span>
                    <Badge variant="outline" className={`text-[10px] ${tipo.color}`}>{tipo.label}</Badge>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {DIAS_SEMANA.map((d, i) => (
                      <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${(alarm.dias || []).includes(i) ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{d}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={alarm.activa} onCheckedChange={() => toggleActiva(alarm)} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar alarma?</AlertDialogTitle><AlertDialogDescription>"{alarm.nombre}" será eliminada.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteM.mutate(alarm.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva Alarma</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Entrada mañana" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Hora *</Label>
                <Input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo">
                  {TIPOS.map(t => <MobileSelectItem key={t.key} value={t.key}>{t.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
            </div>

            {/* Days of week */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Días activos</Label>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setPreset('52')}>5+2</Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setPreset('6')}>6 días</Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setPreset('todos')}>Todos</Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DIAS_SEMANA.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDia(i)}
                    className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${form.dias.includes(i) ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'} ${i >= 5 ? 'ring-1 ring-amber-300' : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">🟡 Fin de semana resaltado · Elige 5+2 para jornada laboral estándar</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre || !form.hora || createM.isPending} className="gap-2 min-w-28">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}