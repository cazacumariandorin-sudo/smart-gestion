/**
 * GestionDiaSheet — herramienta de gerencia/administración.
 * Al pulsar un día del calendario (Informes) permite:
 *  - ver los fichajes existentes de ese día
 *  - forzar el cierre de los fichajes abiertos (sin salida) para esa fecha
 *  - crear manualmente un fichaje para un operario que no lo registró
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import ObraSelectorObras from '@/components/obras/ObraSelectorObras';
import { User, Zap, Plus, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function horasMinutos(hStr) {
  if (!hStr) return null;
  const [h, m] = hStr.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minutosATexto(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function calcularMinutosFichaje(f) {
  const e = horasMinutos(f.hora_entrada); const s = horasMinutos(f.hora_salida);
  if (!e || !s) return 0;
  let d = s - e;
  if (f.pausa_inicio && f.pausa_fin) { const pi = horasMinutos(f.pausa_inicio); const pf = horasMinutos(f.pausa_fin); if (pi && pf) d -= Math.max(0, pf - pi); }
  return Math.max(0, d);
}

export default function GestionDiaSheet({ date, fichajes = [], operarios = [], open, onClose, onUpdated }) {
  const qc = useQueryClient();
  const fecha = date ? format(date, 'yyyy-MM-dd') : '';
  const fechaLabel = date ? format(date, "EEEE, d 'de' MMMM yyyy", { locale: es }) : '';

  const [form, setForm] = useState({
    operario_id: '', operario_name: '',
    hora_entrada: '08:00', hora_salida: '17:00',
    pausa_inicio: '14:00', pausa_fin: '15:00',
    obra_id: '', obra_name: '', obra_tipo: 'obra_civil', project: '',
    notas: '',
  });
  const [creando, setCreando] = useState(false);
  const [closing, setClosing] = useState(false);
  const [preview, setPreview] = useState(null);

  const operariosYaFichados = new Set(fichajes.map(f => f.operario_id));
  const abiertos = fichajes.filter(f => f.hora_entrada && !f.hora_salida);
  const disponibles = operarios.filter(o => o.active !== false && !operariosYaFichados.has(o.id));

  const handleCrear = async () => {
    if (!form.operario_id) { toast.error('Selecciona un operario'); return; }
    if (!form.hora_entrada) { toast.error('Indica la hora de entrada'); return; }
    const op = operarios.find(o => o.id === form.operario_id);
    setCreando(true);
    try {
      await base44.entities.Fichaje.create({
        operario_id: form.operario_id,
        operario_name: op?.name || form.operario_name || '',
        date: fecha,
        hora_entrada: form.hora_entrada,
        hora_salida: form.hora_salida || '',
        pausa_inicio: form.pausa_inicio || '',
        pausa_fin: form.pausa_fin || '',
        obra_id: form.obra_id || '',
        obra_name: form.obra_name || '',
        obra_tipo: form.obra_tipo || 'obra_civil',
        project: form.project || form.obra_name || '',
        notas: form.notas ? `Fichaje creado por gerencia/administración: ${form.notas}` : 'Fichaje creado por gerencia/administración',
      });
      toast.success('Fichaje creado');
      setForm(s => ({ ...s, operario_id: '', operario_name: '', notas: '' }));
      qc.invalidateQueries({ queryKey: ['fichajes_shared'] });
      qc.invalidateQueries({ queryKey: ['fichajes'] });
      onUpdated?.();
    } catch (e) {
      toast.error('Error al crear: ' + e.message);
    } finally { setCreando(false); }
  };

  const handleForzarCierre = async (modo) => {
    if (modo === 'preview') {
      setClosing(true);
      try {
        const res = await base44.functions.invoke('forzarCierreFichajes', { fecha, modo: 'preview' });
        setPreview(res.data);
      } catch (e) { toast.error('Error al consultar: ' + e.message); }
      finally { setClosing(false); }
    } else {
      setClosing(true);
      try {
        const res = await base44.functions.invoke('forzarCierreFichajes', { fecha, modo: 'ejecutar' });
        toast.success(`${res.data?.completados || 0} fichajes cerrados`);
        setPreview(null);
        qc.invalidateQueries({ queryKey: ['fichajes_shared'] });
        qc.invalidateQueries({ queryKey: ['fichajes'] });
        onUpdated?.();
      } catch (e) { toast.error('Error al cerrar: ' + e.message); }
      finally { setClosing(false); }
    }
  };

  if (!date) return null;
  const totalMins = fichajes.reduce((s, f) => s + calcularMinutosFichaje(f), 0);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize text-base">{fechaLabel}</SheetTitle>
          <div className="flex items-center gap-3 mt-1">
            {fichajes.length > 0 && <span className="text-sm font-semibold text-primary">{minutosATexto(totalMins)}</span>}
            <span className="text-xs text-muted-foreground">{fichajes.length} fichaje{fichajes.length !== 1 ? 's' : ''}</span>
            {abiertos.length > 0 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 gap-1"><AlertTriangle className="w-2.5 h-2.5" />{abiertos.length} sin salida</Badge>}
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Fichajes existentes */}
          {fichajes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fichajes existentes</p>
              {fichajes.sort((a, b) => (a.hora_entrada || '').localeCompare(b.hora_entrada || '')).map(f => {
                const mins = calcularMinutosFichaje(f);
                const completo = !!f.hora_entrada && !!f.hora_salida;
                const sinSalida = !!f.hora_entrada && !f.hora_salida;
                return (
                  <div key={f.id} className={cn('rounded-xl border p-3 flex items-center justify-between gap-2',
                    completo ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' :
                    sinSalida ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border bg-card')}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{f.operario_name || '—'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{f.hora_entrada || '--:--'} → {f.hora_salida || '--:--'}{f.project ? ` · ${f.project}` : ''}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {completo
                        ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{minutosATexto(mins)}</Badge>
                        : sinSalida
                        ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1"><AlertTriangle className="w-2.5 h-2.5" />Sin salida</Badge>
                        : <Badge variant="outline" className="text-[10px]">Sin datos</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cierre forzado de fichajes abiertos */}
          {abiertos.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Cierre forzado</p>
              </div>
              <p className="text-xs text-muted-foreground">Cierra los {abiertos.length} fichaje(s) sin salida de este día asignando salida 18:04 y pausa 14:07–15:02.</p>
              {preview ? (
                <div className="space-y-2">
                  {preview.pendientes?.length > 0 && (
                    <div className="rounded-lg border overflow-hidden divide-y divide-border/50">
                      {preview.pendientes.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs bg-background">
                          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="flex-1 font-medium truncate">{p.operario_name}</span>
                          {p.obra && <span className="text-[10px] text-muted-foreground truncate hidden sm:block">{p.obra}</span>}
                          <span className="font-mono text-muted-foreground">{p.hora_entrada}</span>
                          <span className="opacity-50">→</span>
                          <span className="font-mono font-semibold text-amber-600">{p.hora_salida_propuesta}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(null)} disabled={closing}>Cancelar</Button>
                    <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={() => handleForzarCierre('ejecutar')} disabled={closing}>
                      {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Confirmar cierre
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 gap-1.5" onClick={() => handleForzarCierre('preview')} disabled={closing}>
                  {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Forzar cierre de {abiertos.length} fichaje(s)
                </Button>
              )}
            </div>
          )}

          {/* Crear fichaje manual */}
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Crear fichaje</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Registra un fichaje no creado por el técnico en este día.</p>

            {disponibles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Todos los operarios activos ya tienen fichaje este día.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Operario</Label>
                  <MobileSelect value={form.operario_id} onValueChange={v => { const op = operarios.find(o => o.id === v); setForm(s => ({ ...s, operario_id: v, operario_name: op?.name || '' })); }} placeholder="Seleccionar operario..." triggerClassName="w-full h-10">
                    {disponibles.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                  </MobileSelect>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Entrada</Label>
                    <Input type="time" value={form.hora_entrada} onChange={e => setForm(s => ({ ...s, hora_entrada: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Salida</Label>
                    <Input type="time" value={form.hora_salida} onChange={e => setForm(s => ({ ...s, hora_salida: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pausa inicio</Label>
                    <Input type="time" value={form.pausa_inicio} onChange={e => setForm(s => ({ ...s, pausa_inicio: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pausa fin</Label>
                    <Input type="time" value={form.pausa_fin} onChange={e => setForm(s => ({ ...s, pausa_fin: e.target.value }))} className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Obra / lugar (opcional)</Label>
                  <ObraSelectorObras value={{ obra_id: form.obra_id, obra_name: form.obra_name, obra_tipo: form.obra_tipo }}
                    onChange={v => setForm(s => ({ ...s, obra_id: v.obra_id || '', obra_name: v.obra_name || '', obra_tipo: v.obra_tipo || 'obra_civil', project: v.project || v.obra_name || '' }))}
                    triggerClassName="w-full h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Motivo / nota (opcional)</Label>
                  <Input value={form.notas} onChange={e => setForm(s => ({ ...s, notas: e.target.value }))} placeholder="Ej: olvidó fichar" className="h-10" />
                </div>
                <Button size="sm" className="w-full gap-1.5" onClick={handleCrear} disabled={creando || !form.operario_id}>
                  {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Crear fichaje
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}