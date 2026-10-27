/**
 * InformesTab — Control Horario · Módulo de Informes
 *
 * FUENTE DE DATOS ÚNICA: queryKey ['fichajes_shared'], límite 2000.
 * Todas las vistas (calendario, tabla, duplicados) consumen la misma caché.
 * Al eliminar duplicados se invalida esta clave → todas las vistas se actualizan.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, CalendarDays, Table2, Copy, Trash2, AlertTriangle, CheckCircle2, Search, ChevronDown, ChevronRight, Clock, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import CalendarioHorarioView from './CalendarioHorarioView';
import InformeObraView from './InformeObraView';
import QueryErrorFallback from '@/components/QueryErrorFallback';

// ── helpers compartidos ──────────────────────────────────────────────────────

export function horasMinutos(hStr) {
  if (!hStr) return null;
  const [h, m] = hStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutosATexto(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function calcularMinutosFichaje(f) {
  const entrada = horasMinutos(f.hora_entrada);
  const salida  = horasMinutos(f.hora_salida);
  if (!entrada || !salida) return 0;
  let diff = salida - entrada;
  if (f.pausa_inicio && f.pausa_fin) {
    const pi = horasMinutos(f.pausa_inicio);
    const pf = horasMinutos(f.pausa_fin);
    if (pi && pf) diff -= Math.max(0, pf - pi);
  }
  return Math.max(0, diff);
}

// FUENTE ÚNICA — todas las vistas usan esta caché
export function useFichajesShared() {
  return useQuery({
    queryKey: ['fichajes_shared'],
    queryFn: () => base44.entities.Fichaje.list('-date', 5000),
    staleTime: 30_000,
  });
}

// ── TablaView ────────────────────────────────────────────────────────────────

function TablaView({ fichajes }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const agrupados = useMemo(() => {
    const diaFichajes = fichajes.filter(f => f.date?.slice(0, 10) === selectedDate);
    const map = {};
    diaFichajes.forEach(f => {
      if (!map[f.operario_id]) map[f.operario_id] = { name: f.operario_name, registros: [] };
      map[f.operario_id].registros.push(f);
    });
    return Object.entries(map)
      .map(([id, g]) => {
        const regs = g.registros.sort((a, b) => (a.hora_entrada || '').localeCompare(b.hora_entrada || ''));
        const totalMins = regs.reduce((s, f) => s + calcularMinutosFichaje(f), 0);
        const sinSalida = regs.filter(f => !f.hora_salida).length;
        return { id, name: g.name, registros: regs, totalMins, sinSalida };
      })
      .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fichajes, selectedDate, search]);

  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Visión del día</p>
          <h3 className="font-semibold capitalize">
            {format(parseISO(selectedDate), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </h3>
        </div>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar operario…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {agrupados.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin fichajes para este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agrupados.map(g => (
            <div key={g.id} className={cn('rounded-xl border overflow-hidden',
              g.sinSalida > 0 ? 'border-amber-200 dark:border-amber-800' : 'border-emerald-200 dark:border-emerald-800')}>
              <button onClick={() => toggle(g.id)} className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40 transition-colors',
                g.sinSalida > 0 ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-emerald-50/60 dark:bg-emerald-950/20')}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                    {g.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{g.name}</span>
                  <Badge variant="outline" className="text-[10px]">{g.registros.length} reg.</Badge>
                  {g.sinSalida > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />{g.sinSalida} sin salida
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('font-bold', g.sinSalida > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {minutosATexto(g.totalMins)}
                  </span>
                  {expanded[g.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {expanded[g.id] && (
                <div className="border-t border-border/50 divide-y divide-border/40">
                  {g.registros.map(f => {
                    const mins = calcularMinutosFichaje(f);
                    return (
                      <div key={f.id} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-xs bg-background/60">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground uppercase">Entrada</span>
                          <span className="font-mono font-semibold">{f.hora_entrada || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground uppercase">Salida</span>
                          <span className={cn('font-mono font-semibold', !f.hora_salida && 'text-amber-500')}>{f.hora_salida || '--:--'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground uppercase">Total neto</span>
                          <span className={cn('font-bold', f.hora_salida ? 'text-emerald-600' : 'text-amber-500')}>{mins > 0 ? minutosATexto(mins) : '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground uppercase">Obra</span>
                          <span className="truncate">{f.project || '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {agrupados.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: 'Operarios', value: agrupados.length, color: '' },
            { label: 'Horas totales', value: minutosATexto(agrupados.reduce((s, g) => s + g.totalMins, 0)), color: 'text-primary' },
            { label: 'Sin cerrar', value: agrupados.reduce((s, g) => s + g.sinSalida, 0), color: 'text-amber-600' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">{k.label}</p>
              <p className={cn('text-xl font-bold', k.color || 'text-foreground')}>{k.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DuplicadosView ───────────────────────────────────────────────────────────

function DuplicadosView({ fichajes }) {
  const qc = useQueryClient();
  const [eliminando, setEliminando] = useState({});
  const [eliminados, setEliminados] = useState(new Set());

  const grupos = useMemo(() => {
    const map = {};
    fichajes.forEach(f => {
      if (eliminados.has(f.id)) return;
      const key = `${f.operario_id}|${f.date?.slice(0, 10)}|${f.hora_entrada}`;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return Object.entries(map)
      .filter(([, fs]) => fs.length > 1)
      .map(([key, fs]) => ({ key, fichajes: fs.sort((a, b) => (b.hora_salida || '').localeCompare(a.hora_salida || '')) }));
  }, [fichajes, eliminados]);

  const eliminarMutation = useMutation({
    mutationFn: (id) => base44.entities.Fichaje.delete(id),
    onSuccess: (_, id) => {
      setEliminados(prev => new Set([...prev, id]));
      setEliminando(e => { const n = { ...e }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ['fichajes_shared'] });
    },
    onError: (_, id) => setEliminando(e => { const n = { ...e }; delete n[id]; return n; }),
  });

  const eliminarDuplicado = (id) => { setEliminando(e => ({ ...e, [id]: true })); eliminarMutation.mutate(id); };
  const eliminarTodos = () => grupos.forEach(g => g.fichajes.slice(1).forEach(f => eliminarDuplicado(f.id)));

  if (grupos.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-emerald-300 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/10">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Sin duplicados detectados</p>
        <p className="text-xs text-muted-foreground mt-1">{fichajes.length} registros analizados</p>
      </div>
    );
  }

  const totalDups = grupos.reduce((s, g) => s + g.fichajes.length - 1, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Copy className="w-4 h-4 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} con duplicados
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {totalDups} registro{totalDups !== 1 ? 's' : ''} duplicado{totalDups !== 1 ? 's' : ''} · {fichajes.length} total analizados
            </p>
          </div>
        </div>
        <Button size="sm" variant="destructive" onClick={eliminarTodos} disabled={eliminarMutation.isPending} className="gap-1.5 shrink-0">
          <Trash2 className="w-3.5 h-3.5" /> Eliminar todos
        </Button>
      </div>

      <div className="space-y-3">
        {grupos.map(g => {
          const f0 = g.fichajes[0];
          return (
            <div key={g.key} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border text-sm">
                <span className="font-semibold">{f0.operario_name}</span>
                <span className="text-muted-foreground capitalize">
                  {f0.date ? format(parseISO(f0.date), "EEE d MMM", { locale: es }) : '—'}
                </span>
                <span className="font-mono text-xs">{f0.hora_entrada}</span>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                  {g.fichajes.length} copias
                </Badge>
              </div>
              <div className="divide-y divide-border/50">
                {g.fichajes.map((f, idx) => {
                  const mins = calcularMinutosFichaje(f);
                  const esKeeper = idx === 0;
                  return (
                    <div key={f.id} className={cn(
                      'flex items-center gap-3 px-4 py-2.5 text-xs',
                      eliminados.has(f.id) ? 'opacity-30 line-through' : '',
                      esKeeper ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : 'bg-background',
                    )}>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                        esKeeper ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                        {esKeeper ? 'CONSERVAR' : 'DUPLICADO'}
                      </span>
                      <div className="flex items-center gap-4 flex-1 font-mono">
                        <span>E: <strong>{f.hora_entrada || '—'}</strong></span>
                        <span className={f.hora_salida ? '' : 'text-amber-500'}>S: <strong>{f.hora_salida || '--:--'}</strong></span>
                        {mins > 0 && <span className="text-primary font-bold">{minutosATexto(mins)}</span>}
                        {f.project && <span className="text-muted-foreground truncate max-w-28">{f.project}</span>}
                      </div>
                      {!esKeeper && !eliminados.has(f.id) && (
                        <Button size="sm" variant="ghost" onClick={() => eliminarDuplicado(f.id)}
                          disabled={!!eliminando[f.id]}
                          className="h-7 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0">
                          {eliminando[f.id] ? '⏳' : <><Trash2 className="w-3 h-3" /> Eliminar</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── InformesTab principal ────────────────────────────────────────────────────

export default function InformesTab() {
  const [mode, setMode] = useState('calendario');
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const { isAdmin, isJefeObra, user, role } = useUserRole();
  const canSeeAll = isAdmin || isJefeObra || role === 'gerencia' || role === 'director_comercial' || role === 'administracion';
  // Roles restringidos: solo ven y totalizan SUS propios fichajes (diario, semanal, mensual)
  const isOwnDataOnly = ['operario', 'control_horario', 'técnico', 'usuario_demo', 'cliente_obra'].includes(role);

  const { data: fichajes = [], isLoading: fichajesLoading, isError: fichajesError, error: fichajesErrorObj, refetch: refetchFichajes } = useFichajesShared();
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const myOperario = isOwnDataOnly
    ? (operarios.find(o => o.user_email === user?.email) ||
       operarios.find(o => o.email === user?.email) ||
       operarios.find(o => o.user_id === user?.id))
    : null;

  const filtered = useMemo(() => fichajes.filter(f => {
    // Roles restringidos (técnico, operario, control_horario, demo, cliente) solo ven SUS fichajes
    if (isOwnDataOnly && (!myOperario || f.operario_id !== myOperario.id)) return false;
    if (mode === 'calendario') {
      // En modo calendario NO filtrar por mes aquí:
      // CalendarioHorarioView tiene sus propias flechas de navegación y filtra
      // internamente. Pre-filtrar aquí dejaba vacíos los meses anteriores.
      if (opFilter !== 'all' && f.operario_id !== opFilter) return false;
    }
    return true;
  }), [fichajes, opFilter, mode, isOwnDataOnly, myOperario]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const mes = monthFilter ? format(parseISO(monthFilter + '-01'), 'MMMM yyyy', { locale: es }) : 'todos';
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('Control Horario', 14, 18);
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(80, 80, 80); doc.text(mes, 14, 26);
    doc.line(14, 30, 196, 30); let y = 38;
    const cw = 27;
    const hdrs = ['Fecha', 'Operario', 'Entrada', 'Salida', 'Pausa', 'Obra', 'Horas'];
    doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setFillColor(249, 115, 22); doc.setTextColor(255, 255, 255);
    hdrs.forEach((h, i) => { doc.rect(14 + i * cw, y, cw, 6, 'F'); doc.text(h, 16 + i * cw, y + 4); }); y += 6;
    doc.setFont(undefined, 'normal'); doc.setTextColor(20, 20, 20);
    [...filtered].sort((a, b) => a.date > b.date ? 1 : -1).forEach((f, ri) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFillColor(...(ri % 2 === 0 ? [255, 255, 255] : [250, 250, 252]));
      const mins = calcularMinutosFichaje(f);
      [
        f.date ? format(parseISO(f.date), 'dd/MM/yy') : '',
        (f.operario_name || '').slice(0, 14),
        f.hora_entrada || '', f.hora_salida || '',
        (f.pausa_inicio && f.pausa_fin) ? `${f.pausa_inicio.slice(0,5)}-${f.pausa_fin.slice(0,5)}` : '—',
        (f.project || '—').slice(0, 14), minutosATexto(mins),
      ].forEach((c, i) => { doc.rect(14 + i * cw, y, cw, 6, 'F'); doc.text(String(c), 16 + i * cw, y + 4); }); y += 6;
    });
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`${filtered.length} registros · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 290);
    doc.save(`control-horario-${monthFilter || 'todos'}.pdf`);
  };

  const generateExcel = () => {
    const rows = [...filtered].sort((a, b) => a.date > b.date ? 1 : -1).map(f => ({
      Fecha: f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
      Operario: f.operario_name || '', Entrada: f.hora_entrada || '', Salida: f.hora_salida || '',
      'Pausa inicio': f.pausa_inicio || '', 'Pausa fin': f.pausa_fin || '',
      Obra: f.project || '', 'Horas (min)': calcularMinutosFichaje(f),
      'Horas texto': minutosATexto(calcularMinutosFichaje(f)), Notas: f.notas || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fichajes');
    XLSX.writeFile(wb, `control-horario-${monthFilter || 'todos'}.xlsx`);
  };

  const dupCount = useMemo(() => {
    const map = {};
    fichajes.forEach(f => { const k = `${f.operario_id}|${f.date?.slice(0,10)}|${f.hora_entrada}`; map[k] = (map[k] || 0) + 1; });
    return Object.values(map).filter(v => v > 1).length;
  }, [fichajes]);

  const MODES = [
    { value: 'calendario', label: 'Calendario', icon: CalendarDays },
    { value: 'obra', label: 'Por obra', icon: Building2 },
    { value: 'tabla', label: 'Por día', icon: Table2 },
    ...(isAdmin ? [{ value: 'duplicados', label: 'Duplicados', icon: Copy, badge: dupCount }] : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.value} onClick={() => setMode(m.value)} className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                mode === m.value ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
                <Icon className="w-3.5 h-3.5" />
                {m.label}
                {m.badge > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{m.badge}</Badge>}
              </button>
            );
          })}
        </div>
        {mode === 'calendario' && (
          <>
            <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-36 h-9" />
            {canSeeAll && (
              <MobileSelect value={opFilter} onValueChange={setOpFilter} triggerClassName="w-44">
                <MobileSelectItem value="all">Todos</MobileSelectItem>
                {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
              </MobileSelect>
            )}
            <Button onClick={generatePDF} size="sm" className="gap-1.5 h-9"><Download className="w-3.5 h-3.5" /> PDF</Button>
            <Button onClick={generateExcel} size="sm" variant="outline" className="gap-1.5 h-9"><Download className="w-3.5 h-3.5" /> Excel</Button>
          </>
        )}
        {mode === 'obra' && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Building2 className="w-3 h-3" /> Valoración por obra · periodo flexible
          </Badge>
        )}
      </div>

      {fichajesLoading || fichajesError ? (
        <QueryErrorFallback isLoading={fichajesLoading} error={fichajesError ? fichajesErrorObj : null} retryFn={refetchFichajes} />
      ) : (
        <>
          {mode === 'calendario' && <CalendarioHorarioView fichajes={filtered} canSeeAll={canSeeAll} canForce={isAdmin || role === 'gerencia' || role === 'administracion'} operarios={operarios} month={monthFilter} onMonthChange={setMonthFilter} />}
          {mode === 'obra' && <InformeObraView canSeeAll={canSeeAll} forceOperarioId={isOwnDataOnly ? (myOperario?.id || null) : null} />}
          {mode === 'tabla' && <TablaView fichajes={filtered} />}
          {mode === 'duplicados' && isAdmin && <DuplicadosView fichajes={fichajes} />}
        </>
      )}
    </div>
  );
}