/**
 * Vista mensual de previsiones de obra.
 * Props: previsiones[], onDayClick(date, items[])
 */
import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, parseISO, isWithinInterval,
  getDay, format, getWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  en_curso:    'bg-teal-500 text-white',
  planificada: 'bg-amber-400 text-white',
  cancelada:   'bg-red-400 text-white',
  completada:  'bg-slate-400 text-white',
};

// Returns true if a prevision spans/includes this date
function previsionCoversDay(p, dayStr) {
  if (!p.fecha_inicio) return false;
  const start = parseISO(p.fecha_inicio);
  const end = p.fecha_fin ? parseISO(p.fecha_fin) : start;
  const day = parseISO(dayStr);
  return isWithinInterval(day, { start, end });
}

export default function PrevisionCalendario({ previsiones, month, onDayClick }) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  // Pre-index: dayStr → previsiones[]
  const index = useMemo(() => {
    const map = {};
    days.forEach(day => {
      const ds = format(day, 'yyyy-MM-dd');
      map[ds] = previsiones.filter(p => previsionCoversDay(p, ds));
    });
    return map;
  }, [days, previsiones]);

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {days.map(day => {
          const ds = format(day, 'yyyy-MM-dd');
          const items = index[ds] || [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const dow = getDay(day); // 0=Sun,6=Sat
          const isWeekend = dow === 0 || dow === 6;
          const weekNum = getWeek(day, { weekStartsOn: 1 });

          return (
            <div
               key={ds}
               className={[
                 'min-h-[72px] p-1 cursor-pointer transition-colors flex flex-col gap-0.5',
                 inMonth ? (isWeekend ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-card') : 'bg-muted/30',
                 today ? 'ring-2 ring-inset ring-primary' : '',
                 items.length > 0 ? 'hover:bg-primary/5' : 'hover:bg-muted/60',
               ].filter(Boolean).join(' ')}
               onClick={() => onDayClick(day, items)}
             >
               {/* Day number + week number */}
               <div className="flex items-center justify-between mb-0.5">
                 <div className={[
                   'text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full',
                   today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/50',
                 ].join(' ')}>
                   {format(day, 'd')}
                 </div>
                 {dow === 1 && (
                   <span className="text-[10px] font-bold text-primary bg-primary/10 border-2 border-primary/30 px-1.5 py-0.5 rounded">
                     S{weekNum}
                   </span>
                 )}
               </div>

              {/* Previsiones pills */}
              {items.length > 0 && items.length <= 3 && items.map((p, i) => (
                <div
                  key={p.id || i}
                  className={`text-[10px] truncate px-1 py-0.5 rounded font-medium leading-tight ${STATUS_COLORS[p.status] || STATUS_COLORS.planificada}`}
                  title={p.obra_name}
                >
                  {p.obra_name}
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-[10px] px-1 py-0.5 rounded font-medium bg-slate-600 text-white">
                  {items.length} obras
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}