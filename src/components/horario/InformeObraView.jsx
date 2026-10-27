/**
 * InformeObraView — Control Horario · Valoración de horas por obra
 *
 * Permite filtrar fichajes por OBRA y por PERIODO (mes | trimestre | año),
 * agregando las horas trabajadas por cada técnico y su valoración económica
 * (horas × coste_hora del Operario).
 *
 * FUENTE DE DATOS: queryKey ['fichajes_shared'] (compartida con el resto del módulo).
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, Users, Clock, Euro, Download, Search, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { cn } from '@/lib/utils';
import { minutosATexto, calcularMinutosFichaje, useFichajesShared } from './InformesTab';
import OperarioObraDetalleDialog from './OperarioObraDetalleDialog';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import QueryErrorFallback from '@/components/QueryErrorFallback';

const MESES = [
  { v: '01', label: 'Enero' }, { v: '02', label: 'Febrero' }, { v: '03', label: 'Marzo' },
  { v: '04', label: 'Abril' }, { v: '05', label: 'Mayo' }, { v: '06', label: 'Junio' },
  { v: '07', label: 'Julio' }, { v: '08', label: 'Agosto' }, { v: '09', label: 'Septiembre' },
  { v: '10', label: 'Octubre' }, { v: '11', label: 'Noviembre' }, { v: '12', label: 'Diciembre' },
];

// ── Helpers de periodo ───────────────────────────────────────────────────────

export function getPeriodRange(periodType, periodValue) {
  if (periodType === 'mes') {
    const [y, m] = periodValue.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start, end, label: format(start, 'MMMM yyyy', { locale: es }) };
  }
  if (periodType === 'trimestre') {
    const [yStr, tStr] = periodValue.split('-T');
    const y = Number(yStr);
    const t = Number(tStr);
    const startMonth = (t - 1) * 3;
    const start = new Date(y, startMonth, 1);
    const end = new Date(y, startMonth + 3, 0);
    return { start, end, label: `T${t} ${y}` };
  }
  // año
  const y = Number(periodValue);
  const start = new Date(y, 0, 1);
  const end = new Date(y, 12, 0);
  return { start, end, label: String(y) };
}

function inPeriod(dateStr, start, end) {
  if (!dateStr) return false;
  const d = parseISO(dateStr.slice(0, 10));
  return d >= start && d <= end;
}

const PERIOD_TYPES = [
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'año', label: 'Año' },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function InformeObraView({ canSeeAll = false, forceOperarioId = null }) {
  const today = new Date();
  const [periodType, setPeriodType] = useState('mes');
  const [monthValue, setMonthValue] = useState(today.toISOString().slice(0, 7));
  const [trimestreValue, setTrimestreValue] = useState(`${today.getFullYear()}-T${Math.floor(today.getMonth() / 3) + 1}`);
  const [yearValue, setYearValue] = useState(String(today.getFullYear()));
  const [obraFilter, setObraFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOperario, setSelectedOperario] = useState(null);

  const periodValue = periodType === 'mes' ? monthValue : periodType === 'trimestre' ? trimestreValue : yearValue;
  const { start, end, label: periodLabel } = getPeriodRange(periodType, periodValue);

  const { data: fichajes = [], isLoading, isError, error, refetch } = useFichajesShared();
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 500),
  });

  // Mapa operario_id → coste_hora
  const costeHoraMap = useMemo(() => {
    const map = {};
    operarios.forEach(o => { if (o.coste_hora) map[o.id] = o.coste_hora; });
    return map;
  }, [operarios]);

  // Lista de obras únicas con fichajes (derivada de project / obra_name)
  const obrasDisponibles = useMemo(() => {
    const set = new Set();
    fichajes.forEach(f => {
      const name = f.project || f.obra_name;
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [fichajes]);

  // Años con fichajes (+ año actual) para los selectores de periodo
  const yearsDisponibles = useMemo(() => {
    const set = new Set([String(new Date().getFullYear())]);
    fichajes.forEach(f => {
      if (f.date) set.add(f.date.slice(0, 4));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [fichajes]);

  // Fichajes filtrados por periodo + obra (+ operario forzado si rol restringido)
  const fichajesFiltrados = useMemo(() => {
    return fichajes.filter(f => {
      if (forceOperarioId && f.operario_id !== forceOperarioId) return false;
      if (!inPeriod(f.date, start, end)) return false;
      if (obraFilter !== 'all') {
        const name = f.project || f.obra_name;
        if (name !== obraFilter) return false;
      }
      return true;
    });
  }, [fichajes, start, end, obraFilter, forceOperarioId]);

  // Agrupación por operario
  const porOperario = useMemo(() => {
    const map = {};
    fichajesFiltrados.forEach(f => {
      if (!map[f.operario_id]) {
        map[f.operario_id] = {
          id: f.operario_id,
          name: f.operario_name || '—',
          minutos: 0,
          fichajes: 0,
          dias: new Set(),
        };
      }
      map[f.operario_id].minutos += calcularMinutosFichaje(f);
      map[f.operario_id].fichajes += 1;
      if (f.date) map[f.operario_id].dias.add(f.date.slice(0, 10));
    });
    return Object.values(map)
      .map(g => {
        const horas = g.minutos / 60;
        const coste = costeHoraMap[g.id] || 0;
        return {
          ...g,
          horas,
          costeHora: coste,
          valoracion: horas * coste,
          diasCount: g.dias.size,
        };
      })
      .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.minutos - a.minutos);
  }, [fichajesFiltrados, costeHoraMap, search]);

  // Totales
  const totales = useMemo(() => {
    const totalMins = porOperario.reduce((s, g) => s + g.minutos, 0);
    const totalValor = porOperario.reduce((s, g) => s + g.valoracion, 0);
    const totalDias = fichajesFiltrados.reduce((s, f) => s + (f.date ? 1 : 0), 0);
    return {
      totalMins,
      totalHoras: totalMins / 60,
      totalValor,
      numOperarios: porOperario.length,
      totalFichajes: fichajesFiltrados.length,
    };
  }, [porOperario, fichajesFiltrados]);

  // ── Exportación ──────────────────────────────────────────────────────────────

  const obraLabel = obraFilter === 'all' ? 'Todas las obras' : obraFilter;

  const exportExcel = () => {
    const rows = porOperario.map(g => ({
      Operario: g.name,
      'Horas (texto)': minutosATexto(g.minutos),
      'Horas (decimal)': Number(g.horas.toFixed(2)),
      Días: g.diasCount,
      Fichajes: g.fichajes,
      'Coste/hora (€)': g.costeHora || '',
      'Valoración (€)': Number(g.valoracion.toFixed(2)),
    }));
    // Fila de totales
    rows.push({
      Operario: 'TOTAL',
      'Horas (texto)': minutosATexto(totales.totalMins),
      'Horas (decimal)': Number(totales.totalHoras.toFixed(2)),
      Días: '',
      Fichajes: totales.totalFichajes,
      'Coste/hora (€)': '',
      'Valoración (€)': Number(totales.totalValor.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valoración obra');
    XLSX.writeFile(wb, `valoracion-obra-${obraFilter === 'all' ? 'todas' : obraFilter.replace(/\s+/g, '_')}-${periodValue}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(15); doc.setFont(undefined, 'bold'); doc.text('Valoración de horas por obra', 14, 18);
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(`${obraLabel} · ${periodLabel}`, 14, 25);
    doc.line(14, 28, 196, 28);
    let y = 36;
    const cw = [56, 30, 24, 24, 24, 28];
    const hdrs = ['Operario', 'Horas', 'Días', 'Fichajes', 'Coste/h', 'Valoración'];
    doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setFillColor(249, 115, 22); doc.setTextColor(255, 255, 255);
    let x = 14;
    hdrs.forEach((h, i) => { doc.rect(x, y, cw[i], 6, 'F'); doc.text(h, x + 2, y + 4); x += cw[i]; });
    y += 6;
    doc.setFont(undefined, 'normal'); doc.setTextColor(20, 20, 20);
    porOperario.forEach((g, ri) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFillColor(...(ri % 2 === 0 ? [255, 255, 255] : [250, 250, 252]));
      x = 14;
      const cells = [
        (g.name || '').slice(0, 28),
        minutosATexto(g.minutos),
        String(g.diasCount),
        String(g.fichajes),
        g.costeHora ? `${g.costeHora} €` : '—',
        `${g.valoracion.toFixed(2)} €`,
      ];
      cells.forEach((c, i) => { doc.rect(x, y, cw[i], 6, 'F'); doc.text(String(c), x + 2, y + 4); x += cw[i]; });
      y += 6;
    });
    // Total
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFillColor(240, 240, 245); doc.setFont(undefined, 'bold');
    x = 14;
    const totalCells = ['TOTAL', minutosATexto(totales.totalMins), '', String(totales.totalFichajes), '', `${totales.totalValor.toFixed(2)} €`];
    totalCells.forEach((c, i) => { doc.rect(x, y, cw[i], 6, 'F'); doc.text(String(c), x + 2, y + 4); x += cw[i]; });
    y += 10;
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`${totales.numOperarios} operarios · ${totales.totalFichajes} fichajes · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, y);
    doc.save(`valoracion-obra-${obraFilter === 'all' ? 'todas' : obraFilter.replace(/\s+/g, '_')}-${periodValue}.pdf`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading || isError) {
    return <QueryErrorFallback isLoading={isLoading} error={isError ? error : null} retryFn={refetch} />;
  }

  return (
    <div className="space-y-4">
      {/* Selector de periodo + obra */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Periodo</span>
          <MobileSelect value={periodType} onValueChange={(v) => { setPeriodType(v); setObraFilter('all'); }} triggerClassName="w-32">
            {PERIOD_TYPES.map(p => <MobileSelectItem key={p.value} value={p.value}>{p.label}</MobileSelectItem>)}
          </MobileSelect>
        </div>

        {periodType === 'mes' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Año</span>
              <MobileSelect
                value={monthValue.split('-')[0]}
                onValueChange={(y) => setMonthValue(`${y}-${monthValue.split('-')[1] || '01'}`)}
                triggerClassName="w-24"
              >
                {yearsDisponibles.map(y => <MobileSelectItem key={y} value={y}>{y}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Mes</span>
              <MobileSelect
                value={monthValue.split('-')[1] || '01'}
                onValueChange={(m) => setMonthValue(`${monthValue.split('-')[0]}-${m}`)}
                triggerClassName="w-32"
              >
                {MESES.map(mes => <MobileSelectItem key={mes.v} value={mes.v}>{mes.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
          </>
        )}
        {periodType === 'trimestre' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Año</span>
              <MobileSelect value={yearValue} onValueChange={setYearValue} triggerClassName="w-24">
                {yearsDisponibles.map(y => <MobileSelectItem key={y} value={y}>{y}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Trim.</span>
              <MobileSelect
                value={trimestreValue.split('-T')[1] ? `T${trimestreValue.split('-T')[1]}` : 'T1'}
                onValueChange={(v) => setTrimestreValue(`${yearValue}-${v}`)}
                triggerClassName="w-28"
              >
                <MobileSelectItem value="T1">T1 (Ene-Mar)</MobileSelectItem>
                <MobileSelectItem value="T2">T2 (Abr-Jun)</MobileSelectItem>
                <MobileSelectItem value="T3">T3 (Jul-Sep)</MobileSelectItem>
                <MobileSelectItem value="T4">T4 (Oct-Dic)</MobileSelectItem>
              </MobileSelect>
            </div>
          </>
        )}
        {periodType === 'año' && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Año</span>
            <MobileSelect value={yearValue} onValueChange={setYearValue} triggerClassName="w-28">
              {yearsDisponibles.map(y => <MobileSelectItem key={y} value={y}>{y}</MobileSelectItem>)}
            </MobileSelect>
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Obra</span>
          <MobileSelect value={obraFilter} onValueChange={setObraFilter} triggerClassName="w-full">
            <MobileSelectItem value="all">Todas las obras</MobileSelectItem>
            {obrasDisponibles.map(name => <MobileSelectItem key={name} value={name}>{name}</MobileSelectItem>)}
          </MobileSelect>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Horas totales', value: minutosATexto(totales.totalMins), color: 'text-primary', icon: Clock },
          { label: 'Operarios', value: totales.numOperarios, color: 'text-foreground', icon: Users },
          { label: 'Fichajes', value: totales.totalFichajes, color: 'text-foreground', icon: Building2 },
          { label: 'Valoración', value: `${totales.totalValor.toFixed(0)} €`, color: 'text-emerald-600 dark:text-emerald-400', icon: Euro },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              </div>
              <p className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Buscador + exportar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar operario…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPDF} size="sm" variant="outline" className="gap-1.5 h-9"><Download className="w-3.5 h-3.5" /> PDF</Button>
          <Button onClick={exportExcel} size="sm" variant="outline" className="gap-1.5 h-9"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Button>
        </div>
      </div>

      {/* Cabecera del informe */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="w-3.5 h-3.5" />
        <span className="font-medium text-foreground">{obraLabel}</span>
        <span>·</span>
        <span className="capitalize">{periodLabel}</span>
      </div>

      {/* Tabla de valoración */}
      {porOperario.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Sin fichajes {obraFilter !== 'all' ? 'en esta obra' : ''} para el periodo seleccionado
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Operario</th>
                  <th className="text-right font-semibold px-3 py-2">Horas</th>
                  <th className="text-right font-semibold px-3 py-2 hidden sm:table-cell">Días</th>
                  <th className="text-right font-semibold px-3 py-2">Fichajes</th>
                  <th className="text-right font-semibold px-3 py-2 hidden xs:table-cell">Coste/h</th>
                  <th className="text-right font-semibold px-3 py-2">Valoración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porOperario.map(g => (
                  <tr
                    key={g.id}
                    onClick={() => setSelectedOperario(g)}
                    className="hover:bg-primary/5 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                          {g.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground">{g.diasCount} día{g.diasCount !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </td>
                    <td className="text-right px-3 py-2.5 font-bold text-primary whitespace-nowrap">{minutosATexto(g.minutos)}</td>
                    <td className="text-right px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{g.diasCount}</td>
                    <td className="text-right px-3 py-2.5 text-muted-foreground">{g.fichajes}</td>
                    <td className="text-right px-3 py-2.5 hidden xs:table-cell text-muted-foreground whitespace-nowrap">
                      {g.costeHora ? `${g.costeHora} €` : '—'}
                    </td>
                    <td className="text-right px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {g.valoracion > 0 ? `${g.valoracion.toFixed(0)} €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/60 border-t-2 border-border">
                <tr className="font-bold">
                  <td className="px-3 py-3">TOTAL</td>
                  <td className="text-right px-3 py-3 text-primary">{minutosATexto(totales.totalMins)}</td>
                  <td className="text-right px-3 py-3 hidden sm:table-cell"></td>
                  <td className="text-right px-3 py-3">{totales.totalFichajes}</td>
                  <td className="text-right px-3 py-3 hidden xs:table-cell"></td>
                  <td className="text-right px-3 py-3 text-emerald-600 dark:text-emerald-400">{totales.totalValor.toFixed(0)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {canSeeAll && totales.totalValor > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Euro className="w-3 h-3" />
          Valoración = horas × coste/hora del operario. Configura el coste/hora en Ficha de operario.
        </p>
      )}

      <OperarioObraDetalleDialog
        open={!!selectedOperario}
        onOpenChange={(o) => !o && setSelectedOperario(null)}
        operario={selectedOperario}
        fichajes={selectedOperario ? fichajesFiltrados.filter(f => f.operario_id === selectedOperario.id) : []}
        obraLabel={obraLabel}
        periodLabel={periodLabel}
      />
    </div>
  );
}