import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import {
  Wallet, Banknote, Scale, Clock, Download, ChevronDown, ChevronRight, PieChart, Loader2, BarChart3,
} from 'lucide-react';
import RegularizacionPeriodo from '@/components/economico/RegularizacionPeriodo';
import {
  PERIODOS, subPeriodosDe, enPeriodo, etiquetaPeriodo,
} from '@/lib/periodosRegularizacion';

const eur = (n) => `${(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const ESTADOS_JUSTIFICADOS = ['aprobado_gerencia', 'en_administracion', 'pagada'];

const DIMENSIONES = [
  { key: 'operario', label: 'Operario' },
  { key: 'obra', label: 'Obra' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'material', label: 'Material' },
  { key: 'fijos', label: 'Gastos fijos actividad' },
];

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportarCSV(filas, nombreArchivo) {
  if (!filas.length) return;
  const headers = Object.keys(filas[0]);
  const lines = [headers.join(',')];
  for (const f of filas) lines.push(headers.map(h => csvEscape(f[h])).join(','));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContabilidadAnalitica() {
  const now = new Date();
  const [periodo, setPeriodo] = useState('trimestre');
  const [subPeriodo, setSubPeriodo] = useState(Math.floor((now.getMonth() / 3)) + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [dimension, setDimension] = useState('operario');
  const [expanded, setExpanded] = useState(null);
  const [verRegularizacion, setVerRegularizacion] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['eco-registros'],
    queryFn: () => base44.entities.RegistroGasto.list('-fecha_documento', 1000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['eco-obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
  });
  const { data: solarObras = [] } = useQuery({
    queryKey: ['eco-solar-obras'],
    queryFn: () => base44.entities.SolarObra.list('name', 300),
  });
  const { data: adelantos = [] } = useQuery({
    queryKey: ['eco-adelantos'],
    queryFn: () => base44.entities.AdelantoParcialCiclo.list('-fecha_creacion_real', 500),
  });

  // Mapa obra_id → client_name (combina obras civiles y solares)
  const obraClientMap = useMemo(() => {
    const m = {};
    for (const o of obras) if (o.id) m[o.id] = o.client_name || '';
    for (const o of solarObras) if (o.id) m[o.id] = o.client_name || '';
    return m;
  }, [obras, solarObras]);

  // Filtrar registros del periodo seleccionado
  const registrosPeriodo = useMemo(
    () => registros.filter(r => enPeriodo(r.ciclo_mes, anio, periodo, subPeriodo)),
    [registros, anio, periodo, subPeriodo],
  );

  const justificados = useMemo(
    () => registrosPeriodo.filter(r => ESTADOS_JUSTIFICADOS.includes(r.estado)),
    [registrosPeriodo],
  );

  const totalJustificado = useMemo(
    () => justificados.reduce((s, r) => s + (r.importe || 0), 0), [justificados],
  );
  const totalPagado = useMemo(
    () => justificados
      .filter(r => r.estado === 'pagada')
      .reduce((s, r) => s + (r.importe_pagado_real || r.importe || 0), 0),
    [justificados],
  );
  const desviacion = totalJustificado - totalPagado;
  const tardios = useMemo(
    () => registrosPeriodo.filter(r => r.es_gasto_tardio), [registrosPeriodo],
  );
  const totalTardio = useMemo(
    () => tardios.reduce((s, r) => s + (r.importe || 0), 0), [tardios],
  );

  // Desglose por dimensión
  const desglose = useMemo(() => {
    const grupos = {};
    const add = (key, r) => {
      if (!grupos[key]) grupos[key] = { key, registros: [], total: 0, tardios: 0, pagado: 0 };
      grupos[key].registros.push(r);
      grupos[key].total += r.importe || 0;
      if (r.es_gasto_tardio) grupos[key].tardios += r.importe || 0;
      if (r.estado === 'pagada') grupos[key].pagado += r.importe_pagado_real || r.importe || 0;
    };

    for (const r of justificados) {
      switch (dimension) {
        case 'operario':
          add(r.operario_name || 'Sin operario', r);
          break;
        case 'obra':
          add(r.obra_name || 'Sin obra', r);
          break;
        case 'cliente':
          add(obraClientMap[r.obra_id] || 'Sin cliente / Gastos fijos', r);
          break;
        case 'categoria':
          add(r.categoria || 'sin_categoria', r);
          break;
        case 'material':
          if (r.categoria === 'material') add(r.concepto || 'Sin concepto', r);
          break;
        case 'fijos':
          if (r.categoria === 'otros' && !r.obra_id) add('Gastos fijos actividad', r);
          break;
        default:
          break;
      }
    }
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  }, [justificados, dimension, obraClientMap]);

  const subPeriodos = subPeriodosDe(periodo);
  const anios = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const handleExport = () => {
    const filas = desglose.flatMap(g => g.registros.map(r => ({
      Dimension: g.key,
      Operario: r.operario_name || '',
      Obra: r.obra_name || '',
      Cliente: obraClientMap[r.obra_id] || '',
      Categoria: r.categoria || '',
      Concepto: r.concepto || '',
      Importe: r.importe || 0,
      Pagado: r.estado === 'pagada' ? (r.importe_pagado_real || r.importe || 0) : 0,
      Estado: r.estado,
      GastoTardio: r.es_gasto_tardio ? 'Sí' : 'No',
      JustificacionTardia: r.justificacion_tardia || '',
      CicloMes: r.ciclo_mes || '',
      FechaDocumento: r.fecha_documento || '',
    })));
    exportarCSV(filas, `contabilidad_analitica_${etiquetaPeriodo(periodo, subPeriodo, anio).replace(/\s/g, '_')}.csv`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando contabilidad analítica…
      </div>
    );
  }

  if (verRegularizacion) {
    return (
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="w-4 h-4 text-primary" /> Regularización de saldos — {etiquetaPeriodo(periodo, subPeriodo, anio)}
            </div>
            <button
              onClick={() => setVerRegularizacion(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-background border-border text-muted-foreground hover:bg-muted"
            >
              Volver al desglose
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Periodo</label>
              <MobileSelect value={periodo} onValueChange={(v) => { setPeriodo(v); setSubPeriodo(1); }}>
                {PERIODOS.map(p => <MobileSelectItem key={p.key} value={p.key}>{p.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Subperiodo</label>
              <MobileSelect value={String(subPeriodo)} onValueChange={(v) => setSubPeriodo(parseInt(v, 10))}>
                {subPeriodos.map(s => <MobileSelectItem key={s.key} value={String(s.key)}>{s.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Año</label>
              <MobileSelect value={String(anio)} onValueChange={(v) => setAnio(parseInt(v, 10))}>
                {anios.map(a => <MobileSelectItem key={a} value={String(a)}>{a}</MobileSelectItem>)}
              </MobileSelect>
            </div>
          </div>
        </div>
        <RegularizacionPeriodo
          registros={registros}
          adelantos={adelantos}
          periodo={periodo}
          subPeriodo={subPeriodo}
          anio={anio}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selectores de periodo */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {verRegularizacion ? <BarChart3 className="w-4 h-4 text-primary" /> : <PieChart className="w-4 h-4 text-primary" />}
            {verRegularizacion ? 'Regularización de saldos' : 'Contabilidad analítica'} — {etiquetaPeriodo(periodo, subPeriodo, anio)}
          </div>
          <button
            onClick={() => setVerRegularizacion(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              verRegularizacion
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {verRegularizacion ? 'Volver al desglose' : 'Ver regularización'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Periodo</label>
            <MobileSelect value={periodo} onValueChange={(v) => { setPeriodo(v); setSubPeriodo(1); }}>
              {PERIODOS.map(p => <MobileSelectItem key={p.key} value={p.key}>{p.label}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subperiodo</label>
            <MobileSelect value={String(subPeriodo)} onValueChange={(v) => setSubPeriodo(parseInt(v, 10))}>
              {subPeriodos.map(s => <MobileSelectItem key={s.key} value={String(s.key)}>{s.label}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Año</label>
            <MobileSelect value={String(anio)} onValueChange={(v) => setAnio(parseInt(v, 10))}>
              {anios.map(a => <MobileSelectItem key={a} value={String(a)}>{a}</MobileSelectItem>)}
            </MobileSelect>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Gastos justificados" value={eur(totalJustificado)} sub={`${justificados.length} registros`} color="bg-orange-100 text-orange-600" />
        <KpiCard icon={Banknote} label="Pagos realizados" value={eur(totalPagado)} sub={`${justificados.filter(r => r.estado === 'pagada').length} pagados`} color="bg-emerald-100 text-emerald-600" />
        <KpiCard
          icon={Scale}
          label="Desviación (pendiente)"
          value={eur(desviacion)}
          color={desviacion > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
        />
        <KpiCard icon={Clock} label="Gastos tardíos" value={eur(totalTardio)} sub={`${tardios.length} justificantes tardíos`} color="bg-blue-100 text-blue-600" />
      </div>

      {/* Desglose por dimensión */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONES.map(d => (
              <button
                key={d.key}
                onClick={() => { setDimension(d.key); setExpanded(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  dimension === d.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={!desglose.length}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>

        {desglose.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay gastos justificados en este periodo para la dimensión seleccionada.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {desglose.map(g => {
              const isOpen = expanded === g.key;
              const diff = g.total - g.pagado;
              return (
                <div key={g.key}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : g.key)}
                    className="w-full flex items-center gap-3 py-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <span className="flex-1 min-w-0 font-medium text-sm truncate">{g.key}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{g.registros.length} regs.</span>
                    {g.tardios > 0 && (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                        <Clock className="w-3 h-3 mr-1" /> {eur(g.tardios)}
                      </Badge>
                    )}
                    <span className="text-sm font-semibold w-28 text-right">{eur(g.total)}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs w-24 justify-center ${diff > 0 ? 'text-amber-700 border-amber-300 bg-amber-50' : 'text-emerald-700 border-emerald-300 bg-emerald-50'}`}
                    >
                      {diff > 0 ? `+${eur(diff)}` : 'Pagado'}
                    </Badge>
                  </button>
                  {isOpen && (
                    <div className="pb-3 pl-7 space-y-1.5">
                      {g.registros.map(r => (
                        <div key={r.id} className="flex items-start gap-2 text-xs py-1.5 border-t border-border/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {r.concepto || r.categoria || 'Gasto'}
                              {r.es_gasto_tardio && (
                                <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300 bg-amber-50">
                                  <Clock className="w-3 h-3 mr-1" />Tardío
                                </Badge>
                              )}
                            </p>
                            <p className="text-muted-foreground truncate">
                              {r.operario_name || '—'} · {r.obra_name || 'Sin obra'} · {r.ciclo_mes || ''}
                              {r.fecha_documento ? ` · ${r.fecha_documento}` : ''}
                            </p>
                            {r.es_gasto_tardio && r.justificacion_tardia && (
                              <p className="text-amber-700 italic truncate mt-0.5">
                                Justificación: {r.justificacion_tardia}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold">{eur(r.importe)}</p>
                            <p className="text-muted-foreground capitalize">{r.estado?.replace('_', ' ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}