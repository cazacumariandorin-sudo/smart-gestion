/**
 * Vista Gantt de obras — 6 meses centrados en el mes seleccionado
 * Especificación manual v2.0 — sección 4.2 / 4.3
 */
import { useMemo } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, format, parseISO, isWithinInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLORES_ESTADO = {
  activa:      { bar: '#1D9E75', text: '#1D9E75', label: 'En curso' },
  presupuesto: { bar: '#378ADD', text: '#378ADD', label: 'Planificada' },
  pausada:     { bar: '#BA7517', text: '#BA7517', label: 'Pausada' },
  finalizada:  { bar: '#888780', text: '#888780', label: 'Completada' },
};

const OBRA_COLORS = ['#378ADD','#1D9E75','#D85A30','#7F77DD','#BA7517','#E05A9A','#4A9ECC','#5EAA6A','#CC6B35','#9975BB'];

export default function GanttObras({ obras, previsiones, month, onMonthChange }) {
  // 6 meses: 3 antes, mes actual, 2 después
  const meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addMonths(subMonths(month, 2), i));
  }, [month]);

  const hoy = new Date();
  const hoyStr = format(hoy, 'yyyy-MM-dd');

  // Calcular posición de línea "hoy" dentro del rango visible
  const rangoStart = startOfMonth(meses[0]);
  const rangoEnd = endOfMonth(meses[5]);
  const totalDias = differenceInDays(rangoEnd, rangoStart) + 1;
  const diasDesdeInicio = differenceInDays(hoy, rangoStart);
  const pctHoy = Math.max(0, Math.min(100, (diasDesdeInicio / totalDias) * 100));
  const hoyEnRango = hoy >= rangoStart && hoy <= rangoEnd;

  const getBarStyle = (obra) => {
    if (!obra.start_date) return null;
    const s = parseISO(obra.start_date);
    const e = obra.end_date ? parseISO(obra.end_date) : addMonths(s, 3);
    // clamp within visible range
    const barStart = s < rangoStart ? rangoStart : s;
    const barEnd = e > rangoEnd ? rangoEnd : e;
    if (barStart > rangoEnd || barEnd < rangoStart) return null;
    const left = (differenceInDays(barStart, rangoStart) / totalDias) * 100;
    const width = ((differenceInDays(barEnd, barStart) + 1) / totalDias) * 100;
    return { left: `${left}%`, width: `${Math.max(2, width)}%` };
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
      {/* Navegación */}
      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-2 mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonthChange(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <p className="text-xs font-semibold text-muted-foreground">
          {format(meses[0], 'MMM', { locale: es })} – {format(meses[5], 'MMM yyyy', { locale: es })}
        </p>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonthChange(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card" style={{ minWidth: 560 }}>
        {/* Cabecera meses */}
        <div className="flex border-b border-border">
          <div className="w-44 shrink-0 border-r border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground bg-muted/30">OBRA</div>
          <div className="flex-1 relative flex">
            {meses.map((m, i) => (
              <div key={i} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground py-2 border-r border-border last:border-r-0 capitalize">
                {format(m, 'MMM', { locale: es })}
              </div>
            ))}
          </div>
        </div>

        {/* Filas de obras */}
        {obras.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">Sin obras para mostrar</div>
        ) : obras.map((obra, idx) => {
          const cfg = COLORES_ESTADO[obra.status] || COLORES_ESTADO.presupuesto;
          const barStyle = getBarStyle(obra);
          const color = OBRA_COLORS[idx % OBRA_COLORS.length];
          const progreso = obra.porcentaje_avance_horas || 0;
          const prevCount = previsiones.filter(p => p.obra_id === obra.id || p.obra_name === obra.name).length;

          return (
            <div key={obra.id} className="flex border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors">
              {/* Columna izquierda fija */}
              <div className="w-44 shrink-0 border-r border-border px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <p className="text-xs font-semibold truncate" title={obra.name}>{obra.name}</p>
                </div>
                {obra.contact_person && (
                  <p className="text-[10px] text-muted-foreground truncate">{obra.contact_person}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {prevCount > 0 && <span>{prevCount} prev. </span>}
                  <span style={{ color: cfg.text }}>{cfg.label}</span>
                </p>
                {/* Mini barra de progreso para obras activas */}
                {obra.status === 'activa' && progreso > 0 && (
                  <div className="mt-1">
                    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progreso}%`, backgroundColor: color }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{progreso}%</p>
                  </div>
                )}
              </div>

              {/* Área gantt */}
              <div className="flex-1 relative" style={{ minHeight: 52 }}>
                {/* Líneas divisorias de mes */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {meses.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border/50 last:border-r-0" />
                  ))}
                </div>

                {/* Línea de hoy */}
                {hoyEnRango && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
                    style={{ left: `${pctHoy}%` }}
                  />
                )}

                {/* Barra de obra */}
                {barStyle && (
                  <div
                    className="absolute top-3 h-6 rounded-md opacity-90 flex items-center px-2 overflow-hidden"
                    style={{ ...barStyle, backgroundColor: cfg.bar }}
                    title={`${obra.name} — ${cfg.label}${progreso > 0 ? ` (${progreso}%)` : ''}`}
                  >
                    <span className="text-white text-[9px] font-medium truncate">{progreso > 0 ? `${progreso}%` : ''}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
        {Object.entries(COLORES_ESTADO).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: v.bar }} />
            {v.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-px h-3 bg-primary inline-block" />
          Hoy
        </span>
      </div>
      </div> {/* cierre overflow-x-auto */}
    </div>
  );
}