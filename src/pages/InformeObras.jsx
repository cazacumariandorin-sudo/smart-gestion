import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Users, Clock, ChevronLeft, ChevronRight, Calendar, BarChart2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  parseISO, isWithinInterval, eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';

// ─── helpers ───────────────────────────────────────────────────────────────

function rangeLabel(period, anchor) {
  if (period === 'dia')    return format(anchor, "EEEE d 'de' MMMM yyyy", { locale: es });
  if (period === 'semana') {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor, { weekStartsOn: 1 });
    return `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`;
  }
  return format(anchor, 'MMMM yyyy', { locale: es });
}

function getRange(period, anchor) {
  if (period === 'dia')    return { start: anchor, end: anchor };
  if (period === 'semana') return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

function navigate(period, anchor, dir) {
  // dir: +1 forward, -1 back
  if (period === 'dia')    return dir > 0 ? addDays(anchor, 1) : subDays(anchor, 1);
  if (period === 'semana') return dir > 0 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  return dir > 0 ? addMonths(anchor, 1) : subMonths(anchor, 1);
}

function toDateStr(d) { return format(d, 'yyyy-MM-dd'); }

// ─── component ─────────────────────────────────────────────────────────────

export default function InformeObras() {
  const [period, setPeriod] = useState('semana');
  const [anchor, setAnchor] = useState(new Date());
  const [obraFilter, setObraFilter] = useState('all');

  // Data
  const { data: fichajes = [], refetch } = useQuery({
    queryKey: ['fichajes_informe'],
    queryFn: () => base44.entities.Fichaje.list('-date', 2000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
  });

  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { start, end } = useMemo(() => getRange(period, anchor), [period, anchor]);

  // Fichajes within range
  const filtered = useMemo(() => {
    return fichajes.filter(f => {
      if (!f.date) return false;
      const d = parseISO(f.date);
      const inRange = isWithinInterval(d, { start, end });
      const inObra = obraFilter === 'all' || f.project === obraFilter;
      return inRange && inObra;
    });
  }, [fichajes, start, end, obraFilter]);

  // Build unique list of obras present in current range (for filter options)
  const obrasEnRango = useMemo(() => {
    const names = [...new Set(fichajes
      .filter(f => {
        if (!f.date) return false;
        return isWithinInterval(parseISO(f.date), { start, end });
      })
      .map(f => f.project)
      .filter(Boolean)
    )];
    return names.sort();
  }, [fichajes, start, end]);

  // Group by obra → operario
  const grouped = useMemo(() => {
    const map = {}; // obra → { operario_id → { name, days: Set, totalHours, entries[] } }
    filtered.forEach(f => {
      const obra = f.project || 'Sin obra';
      const opId = f.operario_id || f.operario_name || 'desconocido';
      const opName = f.operario_name || opId;
      if (!map[obra]) map[obra] = {};
      if (!map[obra][opId]) map[obra][opId] = { name: opName, days: new Set(), totalHours: 0, entries: [] };
      map[obra][opId].days.add(f.date);
      map[obra][opId].totalHours += f.horas_trabajadas || 0;
      map[obra][opId].entries.push(f);
    });
    // Sort obras
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([obra, ops]) => ({
        obra,
        operarios: Object.values(ops).sort((a, b) => a.name.localeCompare(b.name)),
        totalHoras: Object.values(ops).reduce((s, o) => s + o.totalHours, 0),
        totalOperarios: Object.keys(ops).length,
      }));
  }, [filtered]);

  // Day-level breakdown (only for 'dia' and 'semana' periods)
  const dayBreakdown = useMemo(() => {
    if (period === 'mes') return null;
    const days = eachDayOfInterval({ start, end });
    return days.map(day => {
      const ds = toDateStr(day);
      const dayFichajes = filtered.filter(f => f.date === ds);
      const ops = [...new Map(dayFichajes.map(f => [f.operario_id || f.operario_name, f])).values()];
      return { day, ds, fichajes: dayFichajes, operarios: ops.length, horas: dayFichajes.reduce((s, f) => s + (f.horas_trabajadas || 0), 0) };
    });
  }, [filtered, period, start, end]);

  const totalHoras = grouped.reduce((s, g) => s + g.totalHoras, 0);
  const totalOps = new Set(filtered.map(f => f.operario_id || f.operario_name)).size;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart2 className="w-7 h-7 text-primary" /> Informe Operarios en Obra
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Asistencia y horas por obra y período</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Tabs value={period} onValueChange={v => { setPeriod(v); setAnchor(new Date()); }}>
          <TabsList>
            <TabsTrigger value="dia">Día</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
          </TabsList>
        </Tabs>

        <MobileSelect value={obraFilter} onValueChange={setObraFilter} placeholder="Obra" triggerClassName="w-full sm:w-56">
          <MobileSelectItem value="all">Todas las obras</MobileSelectItem>
          {obrasEnRango.map(o => <MobileSelectItem key={o} value={o}>{o}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-2.5 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor(a => navigate(period, a, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">{rangeLabel(period, anchor)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor(a => navigate(period, a, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{grouped.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Obras activas</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalOps}</p>
          <p className="text-xs text-muted-foreground mt-1">Operarios</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalHoras.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">Horas totales</p>
        </Card>
      </div>

      {/* Day breakdown for dia/semana */}
      {dayBreakdown && dayBreakdown.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por día</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {dayBreakdown.map(({ day, ds, operarios, horas }) => {
              const isToday = toDateStr(day) === toDateStr(new Date());
              return (
                <Card key={ds} className={`p-3 text-center ${isToday ? 'border-primary ring-1 ring-primary' : ''}`}>
                  <p className="text-[10px] text-muted-foreground capitalize">{format(day, 'EEE', { locale: es })}</p>
                  <p className="text-sm font-bold">{format(day, 'd')}</p>
                  {operarios > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-primary mt-1">{operarios} ops</p>
                      <p className="text-[10px] text-muted-foreground">{horas.toFixed(1)}h</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1">—</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main grouped list */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay fichajes registrados en este período</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => (
            <Card key={g.obra} className="overflow-hidden">
              {/* Obra header */}
              <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">{g.obra}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g.totalOperarios} ops</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {g.totalHoras.toFixed(1)}h</span>
                </div>
              </div>

              {/* Operarios list */}
              <div className="divide-y divide-border">
                {g.operarios.map(op => (
                  <div key={op.name} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {op.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{op.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        <Calendar className="w-3 h-3 mr-1" />
                        {op.days.size} {op.days.size === 1 ? 'día' : 'días'}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                        <Clock className="w-3 h-3 mr-1" />
                        {op.totalHours.toFixed(1)}h
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}