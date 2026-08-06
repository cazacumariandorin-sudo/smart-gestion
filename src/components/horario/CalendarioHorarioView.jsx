import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, User, Building2, CheckCircle2, AlertTriangle, XCircle, Coffee, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
  const entrada = horasMinutos(f.hora_entrada); const salida = horasMinutos(f.hora_salida);
  if (!entrada || !salida) return 0;
  let diff = salida - entrada;
  if (f.pausa_inicio && f.pausa_fin) { const pi = horasMinutos(f.pausa_inicio); const pf = horasMinutos(f.pausa_fin); if (pi && pf) diff -= Math.max(0, pf - pi); }
  return Math.max(0, diff);
}

function DiaCell({ date, fichajesDia = [], canSeeAll, isCurrentMonth, onClick }) {
  const sinSalida = fichajesDia.filter(f => f.hora_entrada && !f.hora_salida).length;
  const estado = fichajesDia.length === 0 ? 'vacio' : sinSalida > 0 ? 'incompleto' : 'completo';
  const totalMins = fichajesDia.reduce((s, f) => s + calcularMinutosFichaje(f), 0);
  const trabajadores = new Set(fichajesDia.map(f => f.operario_id)).size;
  const hoy = isToday(date);
  const diaSemana = getDay(date);
  const esFinSemana = diaSemana === 0 || diaSemana === 6;
  const hasFichajes = fichajesDia.length > 0;

  return (
    <button
      onClick={() => hasFichajes && onClick(date, fichajesDia)}
      className={cn(
        'relative flex flex-col rounded-lg border transition-all duration-100 select-none p-1.5 min-h-[72px]',
        !isCurrentMonth ? 'border-transparent opacity-30 pointer-events-none' :
        !hasFichajes && esFinSemana ? 'border-border/30 bg-muted/20 cursor-default' :
        !hasFichajes ? 'border-border/40 bg-background cursor-default hover:bg-muted/20' :
        estado === 'completo' ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 active:scale-[0.97] cursor-pointer' :
        'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 active:scale-[0.97] cursor-pointer',
        hoy && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      <span className={cn('text-xs font-bold leading-none mb-1', hoy ? 'text-primary' : 'text-foreground', (!hasFichajes || esFinSemana) && 'text-muted-foreground')}>
        {format(date, 'd')}
      </span>
      {hasFichajes && (
        <div className="flex flex-col gap-0.5 flex-1">
          <span className={cn('text-[11px] font-bold', estado === 'completo' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
            {minutosATexto(totalMins)}
          </span>
          {canSeeAll && trabajadores > 0 && <span className="text-[9px] text-muted-foreground">{trabajadores} pers.</span>}
          <div className="mt-auto flex justify-end">
            {estado === 'completo' ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
          </div>
        </div>
      )}
    </button>
  );
}

function DetalleDiaSheet({ date, fichajes, open, onClose }) {
  if (!date) return null;
  const totalMins = fichajes.reduce((s, f) => s + calcularMinutosFichaje(f), 0);
  const sinSalida = fichajes.filter(f => !f.hora_salida).length;
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize text-base">{format(date, "EEEE, d 'de' MMMM yyyy", { locale: es })}</SheetTitle>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold text-primary">{minutosATexto(totalMins)}</span>
            <span className="text-xs text-muted-foreground">{fichajes.length} fichaje{fichajes.length !== 1 ? 's' : ''}</span>
            {sinSalida > 0 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 gap-1"><AlertTriangle className="w-2.5 h-2.5" />{sinSalida} sin salida</Badge>}
          </div>
        </SheetHeader>
        <div className="space-y-3">
          {fichajes.sort((a, b) => (a.hora_entrada || '').localeCompare(b.hora_entrada || '')).map(f => {
            const mins = calcularMinutosFichaje(f);
            const completo = !!f.hora_entrada && !!f.hora_salida;
            const sinSalidaF = !!f.hora_entrada && !f.hora_salida;
            return (
              <div key={f.id} className={cn('rounded-xl border p-3 space-y-2.5',
                completo ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' :
                sinSalidaF ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border bg-card')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5 text-primary" /></div>
                    <div>
                      <p className="text-sm font-semibold">{f.operario_name || '—'}</p>
                      {f.project && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{f.project}</p>}
                    </div>
                  </div>
                  {completo
                    ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{minutosATexto(mins)}</Badge>
                    : sinSalidaF
                    ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1"><AlertTriangle className="w-2.5 h-2.5" />Sin salida</Badge>
                    : <Badge variant="outline" className="text-[10px]">Sin datos</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Entrada', value: f.hora_entrada, alert: false },
                    { label: 'Salida', value: f.hora_salida, alert: sinSalidaF },
                    { label: 'Total', value: mins > 0 ? minutosATexto(mins) : null, primary: true },
                  ].map(({ label, value, alert, primary }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-background/80 border border-border/50">
                      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                      <span className={cn('font-bold text-sm', primary ? 'text-primary' : alert ? 'text-amber-500' : value ? 'text-foreground' : 'text-muted-foreground')}>{value || '--:--'}</span>
                    </div>
                  ))}
                </div>
                {f.pausa_inicio && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/60 rounded-lg px-2 py-1.5 border border-border/40">
                    <Coffee className="w-3 h-3 shrink-0" />
                    <span>Pausa: {f.pausa_inicio} → {f.pausa_fin || '--:--'}</span>
                    {f.pausa_inicio && f.pausa_fin && <span className="ml-auto font-medium">{minutosATexto(horasMinutos(f.pausa_fin) - horasMinutos(f.pausa_inicio))}</span>}
                  </div>
                )}
                {(f.apuntes_asociados || f.apuntes)?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><ClipboardCheck className="w-2.5 h-2.5" />Apuntes</p>
                    {(f.apuntes_asociados || f.apuntes).map((a, i) => (
                      <div key={i} className="text-[11px] bg-background/60 rounded px-2 py-1 border border-border/30 text-muted-foreground">{a.descripcion || a.tipo || JSON.stringify(a)}</div>
                    ))}
                  </div>
                )}
                {f.notas && <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2">{f.notas}</p>}
              </div>
            );
          })}
        </div>
        {fichajes.length === 0 && <div className="flex flex-col items-center gap-2 py-12 text-center"><XCircle className="w-8 h-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Sin fichajes este día</p></div>}
      </SheetContent>
    </Sheet>
  );
}

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function CalendarioHorarioView({ fichajes = [], canSeeAll = false, month, onMonthChange }) {
  const [mesInterno, setMesInterno] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [fichajesDia, setFichajesDia] = useState([]);

  // Mes controlado: si el padre pasa `month` (YYYY-MM) + `onMonthChange`, el selector
  // externo de mes dirige el calendario; si no, se usa el estado interno (flechas).
  const mesActual = month ? new Date(month + '-01T00:00:00') : mesInterno;
  const mesKey = format(mesActual, 'yyyy-MM');
  const setMesActual = (d) => {
    if (onMonthChange) onMonthChange(format(d, 'yyyy-MM'));
    else setMesInterno(d);
  };

  const diasMes = useMemo(() => {
    const inicio = startOfMonth(mesActual); const fin = endOfMonth(mesActual);
    const dias = eachDayOfInterval({ start: inicio, end: fin });
    let primerDia = getDay(inicio) - 1; if (primerDia < 0) primerDia = 6;
    const celdas = [];
    for (let i = 0; i < primerDia; i++) celdas.push(null);
    dias.forEach(d => celdas.push(d));
    while (celdas.length % 7 !== 0) celdas.push(null);
    return celdas;
  }, [mesKey]);

  const fichajesPorDia = useMemo(() => {
    const map = {};
    fichajes.forEach(f => {
      if (!f.date) return;
      const key = f.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [fichajes]);

  const { totalMinsMes, diasConFichajes, trabajadoresUnicos, sinSalidaMes } = useMemo(() => {
    let totalMinsMes = 0; const diasSet = new Set(); const trabSet = new Set(); let sinSalidaMes = 0;
    const pref = mesKey;
    fichajes.forEach(f => {
      if (!f.date?.startsWith(pref)) return;
      totalMinsMes += calcularMinutosFichaje(f);
      diasSet.add(f.date.slice(0, 10)); trabSet.add(f.operario_id);
      if (f.hora_entrada && !f.hora_salida) sinSalidaMes++;
    });
    return { totalMinsMes, diasConFichajes: diasSet.size, trabajadoresUnicos: trabSet.size, sinSalidaMes };
  }, [fichajes, mesKey]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Horas mes', value: minutosATexto(totalMinsMes), color: 'text-primary' },
          { label: 'Días trabajados', value: diasConFichajes, color: 'text-foreground' },
          canSeeAll ? { label: 'Trabajadores', value: trabajadoresUnicos, color: 'text-foreground' } : null,
          sinSalidaMes > 0 ? { label: 'Sin salida', value: sinSalidaMes, color: 'text-amber-600 dark:text-amber-400' } : null,
        ].filter(Boolean).map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">{kpi.label}</p>
            <p className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMesActual(subMonths(mesActual, 1))} className="gap-1">
          <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline text-xs">Anterior</span>
        </Button>
        <h2 className="text-sm font-bold capitalize">{format(mesActual, 'MMMM yyyy', { locale: es })}</h2>
        <Button variant="ghost" size="sm" onClick={() => setMesActual(addMonths(mesActual, 1))} className="gap-1">
          <span className="hidden sm:inline text-xs">Siguiente</span><ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className={cn('text-center text-[10px] font-bold uppercase tracking-wider py-1', d === 'S' || d === 'D' ? 'text-muted-foreground/60' : 'text-muted-foreground')}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {diasMes.map((date, idx) => {
          if (!date) return <div key={`e-${idx}`} />;
          const key = format(date, 'yyyy-MM-dd');
          return (
            <DiaCell key={key} date={date} fichajesDia={fichajesPorDia[key] || []} canSeeAll={canSeeAll}
              isCurrentMonth={isSameMonth(date, mesActual)}
              onClick={(d, fs) => { setDiaSeleccionado(d); setFichajesDia(fs); }} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        {[{ color: 'bg-emerald-200 dark:bg-emerald-800', label: 'Completo' }, { color: 'bg-amber-200 dark:bg-amber-800', label: 'Sin salida' }, { color: 'bg-muted', label: 'Sin fichajes' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={cn('w-3 h-3 rounded-sm', color)} />{label}
          </div>
        ))}
      </div>
      <DetalleDiaSheet date={diaSeleccionado} fichajes={fichajesDia} open={!!diaSeleccionado} onClose={() => setDiaSeleccionado(null)} />
    </div>
  );
}