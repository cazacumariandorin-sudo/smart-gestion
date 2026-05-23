/**
 * PrevisionObras — BLOQUE 4
 * Página Gantt de previsión de obras en /prevision-obras
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { RefreshCw, ExternalLink, BarChart3 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, addDays, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const SEMAFORO = {
  verde:     { color: '#1D9E75', bg: '#E1F5EE', border: '#1D9E75', label: 'En plazo' },
  amarillo:  { color: '#BA7517', bg: '#FAEEDA', border: '#BA7517', label: 'Atención' },
  rojo:      { color: '#E24B4A', bg: '#FCEBEB', border: '#E24B4A', label: 'Retraso' },
  sin_datos: { color: '#888780', bg: '#F5F5F5', border: '#CCCCCC', label: 'Sin previsión' },
};

function GanttBar({ obra, prevision, rangeStart, rangeEnd, totalDays }) {
  const [hovered, setHovered] = useState(false);
  const semKey = prevision?.status_semaforo || 'sin_datos';
  const sem = SEMAFORO[semKey];

  if (!prevision?.fecha_inicio) return (
    <div className="flex-1 h-8 bg-muted/30 rounded flex items-center px-2">
      <span className="text-xs text-muted-foreground italic">Sin fechas de previsión</span>
    </div>
  );

  const barStart = new Date(prevision.fecha_inicio);
  const barEnd = new Date(prevision.fecha_fin || prevision.fecha_inicio);
  const rangeS = new Date(rangeStart);
  const rangeE = new Date(rangeEnd);

  const clampedStart = barStart < rangeS ? rangeS : barStart;
  const clampedEnd = barEnd > rangeE ? rangeE : barEnd;

  if (clampedStart > clampedEnd) return <div className="flex-1 h-8" />;

  const leftPct = (differenceInDays(clampedStart, rangeS) / totalDays) * 100;
  const widthPct = Math.max(1, (differenceInDays(clampedEnd, clampedStart) + 1) / totalDays * 100);
  const avancePct = prevision.porcentaje_avance_horas || 0;

  const shortName = obra.name.length > 20 ? obra.name.substring(0, 18) + '…' : obra.name;

  return (
    <div className="flex-1 relative h-8">
      <div
        className="absolute h-8 rounded overflow-hidden cursor-pointer transition-shadow"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          background: sem.bg,
          border: `1.5px solid ${sem.border}`,
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.15)' : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Barra de avance */}
        <div
          className="absolute left-0 top-0 h-full opacity-40"
          style={{ width: `${avancePct}%`, background: sem.border }}
        />
        <div className="absolute inset-0 flex items-center px-2 z-10">
          <span className="text-[10px] font-semibold truncate" style={{ color: sem.color }}>
            {shortName} — {avancePct}%
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-10 left-0 z-50 bg-popover border border-border rounded-lg p-3 shadow-xl text-xs min-w-48 pointer-events-none">
          <p className="font-bold mb-1">{obra.name}</p>
          <p>Estado: <span className="font-semibold" style={{ color: sem.color }}>{sem.label}</span></p>
          <p>Horas: {(prevision.horas_reales_acumuladas || 0).toFixed(1)}h / {(prevision.horas_totales_previstas || 0).toFixed(1)}h</p>
          <p>Avance: {avancePct}%</p>
          {prevision.ultimo_fichaje_fecha && <p>Último fichaje: {format(parseISO(prevision.ultimo_fichaje_fecha), 'd MMM', { locale: es })}</p>}
          {(prevision.operarios_activos_hoy || []).length > 0 && <p>{prevision.operarios_activos_hoy.length} operario(s) hoy</p>}
        </div>
      )}
    </div>
  );
}

export default function PrevisionObras() {
  const qc = useQueryClient();
  const [tipoFilter, setTipoFilter] = useState('all');
  const [semaforoFilter, setSemaforoFilter] = useState('all');
  const [rangeMode, setRangeMode] = useState('mes');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data: obrasCiviles = [], isLoading: l1 } = useQuery({
    queryKey: ['obras-civiles-gantt'],
    queryFn: () => base44.entities.Obra.filter({ '$or': [{ status: 'activa' }, { status: 'pausada' }] }),
  });
  const { data: obrasSolar = [], isLoading: l2 } = useQuery({
    queryKey: ['solar-obras-gantt'],
    queryFn: () => base44.entities.SolarObra.filter({ '$or': [{ status: 'activa' }, { status: 'pausada' }] }),
  });
  const { data: previsiones = [], isLoading: l3, dataUpdatedAt } = useQuery({
    queryKey: ['previsiones-gantt'],
    queryFn: () => base44.entities.PrevisionObra.list(),
  });

  const lastUpdate = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'dd/MM/yyyy HH:mm') : '—';
  const isLoading = l1 || l2 || l3;

  // Combinar obras
  const allObras = useMemo(() => [
    ...obrasCiviles.map(o => ({ ...o, _tipo: 'civil' })),
    ...obrasSolar.map(o => ({ ...o, _tipo: 'solar' })),
  ], [obrasCiviles, obrasSolar]);

  const previsionByObra = useMemo(() => {
    const map = {};
    previsiones.forEach(p => { if (p.obra_id) map[p.obra_id] = p; });
    return map;
  }, [previsiones]);

  // Rango de fechas
  const { rangeStart, rangeEnd } = useMemo(() => {
    const today = new Date();
    if (rangeMode === 'mes') return { rangeStart: format(startOfMonth(today), 'yyyy-MM-dd'), rangeEnd: format(endOfMonth(today), 'yyyy-MM-dd') };
    if (rangeMode === 'trimestre') {
      const s = startOfMonth(today);
      const e = endOfMonth(addDays(s, 89));
      return { rangeStart: format(s, 'yyyy-MM-dd'), rangeEnd: format(e, 'yyyy-MM-dd') };
    }
    return { rangeStart: customStart, rangeEnd: customEnd };
  }, [rangeMode, customStart, customEnd]);

  const totalDays = Math.max(1, differenceInDays(new Date(rangeEnd), new Date(rangeStart)) + 1);
  const useWeeks = totalDays > 60;

  // Columnas del eje de tiempo
  const timeColumns = useMemo(() => {
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    if (useWeeks) {
      return eachWeekOfInterval({ start: s, end: e }, { weekStartsOn: 1 }).map(d => ({
        label: `S${format(d, 'ww')}`,
        date: d,
        left: (differenceInDays(d, s) / totalDays) * 100,
      }));
    }
    return eachDayOfInterval({ start: s, end: e }).map(d => ({
      label: format(d, 'd'),
      date: d,
      left: (differenceInDays(d, s) / totalDays) * 100,
    }));
  }, [rangeStart, rangeEnd, totalDays, useWeeks]);

  const hoyLeft = useMemo(() => {
    const todayDiff = differenceInDays(new Date(), new Date(rangeStart));
    if (todayDiff < 0 || todayDiff > totalDays) return null;
    return (todayDiff / totalDays) * 100;
  }, [rangeStart, totalDays]);

  // Filtros
  const filtered = useMemo(() => allObras.filter(o => {
    if (tipoFilter !== 'all' && o._tipo !== tipoFilter) return false;
    if (semaforoFilter !== 'all') {
      const prev = previsionByObra[o.id];
      const sem = prev?.status_semaforo || 'sin_datos';
      if (sem !== semaforoFilter) return false;
    }
    return true;
  }), [allObras, tipoFilter, semaforoFilter, previsionByObra]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['obras-civiles-gantt'] });
    qc.invalidateQueries({ queryKey: ['solar-obras-gantt'] });
    qc.invalidateQueries({ queryKey: ['previsiones-gantt'] });
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="Previsión de Obras"
        subtitle="Vista Gantt de planificación y seguimiento"
        hideBack={true}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Act. {lastUpdate}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5">
          <MobileSelect value={tipoFilter} onValueChange={setTipoFilter} placeholder="Tipo" triggerClassName="w-40">
            <MobileSelectItem value="all">Todas las obras</MobileSelectItem>
            <MobileSelectItem value="civil">🏗 Sólo civiles</MobileSelectItem>
            <MobileSelectItem value="solar">☀ Sólo solar</MobileSelectItem>
          </MobileSelect>
          <MobileSelect value={semaforoFilter} onValueChange={setSemaforoFilter} placeholder="Estado" triggerClassName="w-44">
            <MobileSelectItem value="all">Todos los estados</MobileSelectItem>
            <MobileSelectItem value="verde">🟢 En plazo</MobileSelectItem>
            <MobileSelectItem value="amarillo">🟡 Atención</MobileSelectItem>
            <MobileSelectItem value="rojo">🔴 Retraso</MobileSelectItem>
            <MobileSelectItem value="sin_datos">⬛ Sin previsión</MobileSelectItem>
          </MobileSelect>
          <MobileSelect value={rangeMode} onValueChange={setRangeMode} placeholder="Rango" triggerClassName="w-36">
            <MobileSelectItem value="mes">Mes actual</MobileSelectItem>
            <MobileSelectItem value="trimestre">Trimestre</MobileSelectItem>
            <MobileSelectItem value="custom">Personalizado</MobileSelectItem>
          </MobileSelect>
          {rangeMode === 'custom' && (
            <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40" />
            </>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay obras que coincidan con los filtros</p>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 700 }}>
              {/* Cabecera días/semanas */}
              <div className="flex mb-1">
                <div className="w-48 shrink-0" />
                <div className="flex-1 relative h-6">
                  {timeColumns.map((col, i) => (
                    <div
                      key={i}
                      className="absolute text-[10px] text-muted-foreground font-mono"
                      style={{ left: `${col.left}%`, transform: 'translateX(-50%)' }}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Filas */}
              <div className="space-y-1">
                {filtered.map(o => {
                  const prev = previsionByObra[o.id];
                  const sem = SEMAFORO[prev?.status_semaforo || 'sin_datos'];
                  const detailPath = o._tipo === 'civil' ? '/obras-civiles' : '/solar';
                  return (
                    <div key={o.id} className="flex items-center gap-2 h-10">
                      {/* Nombre */}
                      <div className="w-48 shrink-0 flex items-center gap-2 pr-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sem.color }} />
                        <span className="text-xs font-medium truncate flex-1">{o.name}</span>
                        <Badge className="text-[9px] px-1 py-0 h-4 shrink-0" style={{ background: o._tipo === 'solar' ? '#FEF9C3' : '#EDE9FE', color: o._tipo === 'solar' ? '#92400E' : '#5B21B6', border: 'none' }}>
                          {o._tipo === 'solar' ? '☀' : '🏗'}
                        </Badge>
                        <Link to={detailPath} className="text-muted-foreground hover:text-primary shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {/* Barra Gantt */}
                      <div className="flex-1 relative">
                        {/* Línea HOY */}
                        {hoyLeft !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
                            style={{ left: `${hoyLeft}%`, borderLeft: '2px dashed #E24B4A' }}
                          />
                        )}
                        <GanttBar obra={o} prevision={prev} rangeStart={rangeStart} rangeEnd={rangeEnd} totalDays={totalDays} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border">
          {Object.entries(SEMAFORO).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color }} />
              {v.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-0.5 border-t-2 border-dashed border-red-500" />
            Hoy
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-2 rounded opacity-40 bg-gray-500" />
            Avance real
          </div>
        </div>
      </div>
    </div>
  );
}