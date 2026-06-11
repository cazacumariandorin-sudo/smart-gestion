import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, User } from 'lucide-react';

const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmt(n) {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function VariacionBadge({ actual, anterior }) {
  if (!anterior || !actual) return <span className="text-muted-foreground text-[11px]">—</span>;
  const pct = ((actual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-red-600 font-semibold">
      <TrendingUp className="w-3 h-3" /> +{pct.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-green-600 font-semibold">
      <TrendingDown className="w-3 h-3" /> {pct.toFixed(1)}%
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </span>
          <span className="font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function TendenciaNominas({ nominas }) {
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState(null);

  // Todos los años/meses disponibles
  const todosLosAnios = useMemo(() =>
    [...new Set(nominas.map(n => n.anio))].sort((a, b) => a - b), [nominas]);

  // Trabajadores únicos
  const trabajadores = useMemo(() => {
    const map = {};
    for (const n of nominas) {
      const key = n.operario_dni || n.operario_name || n.id;
      if (!map[key]) map[key] = { key, name: n.operario_name || 'Sin nombre', dni: n.operario_dni };
    }
    return Object.values(map).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [nominas]);

  // Datos para el gráfico global (coste total empresa por mes, todos los años)
  const datosGlobales = useMemo(() => {
    const map = {};
    for (const n of nominas) {
      const clave = `${n.anio}-${String(n.mes).padStart(2, '0')}`;
      if (!map[clave]) map[clave] = { label: `${MESES_CORTO[n.mes]} ${n.anio}`, anio: n.anio, mes: n.mes, coste: 0, liquido: 0 };
      map[clave].coste += n.coste_empresa || 0;
      map[clave].liquido += n.liquido_percibir || 0;
    }
    return Object.values(map).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  }, [nominas]);

  // Datos para el gráfico del trabajador seleccionado
  const datosTrabajador = useMemo(() => {
    if (!trabajadorSeleccionado) return [];
    const noms = nominas.filter(n =>
      (n.operario_dni || n.operario_name || n.id) === trabajadorSeleccionado
    );
    const map = {};
    for (const n of noms) {
      const clave = `${n.anio}-${String(n.mes).padStart(2, '0')}`;
      if (!map[clave]) map[clave] = { label: `${MESES_CORTO[n.mes]} ${n.anio}`, anio: n.anio, mes: n.mes, coste: 0, liquido: 0 };
      map[clave].coste += n.coste_empresa || 0;
      map[clave].liquido += n.liquido_percibir || 0;
    }
    return Object.values(map).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  }, [nominas, trabajadorSeleccionado]);

  const datosGrafico = trabajadorSeleccionado ? datosTrabajador : datosGlobales;
  const nombreTrabajador = trabajadorSeleccionado
    ? trabajadores.find(t => t.key === trabajadorSeleccionado)?.name
    : null;

  // Top 3 trabajadores por coste total
  const top3 = useMemo(() => {
    const map = {};
    for (const n of nominas) {
      const key = n.operario_dni || n.operario_name || n.id;
      if (!map[key]) map[key] = { key, name: n.operario_name || 'Sin nombre', coste: 0 };
      map[key].coste += n.coste_empresa || 0;
    }
    return Object.values(map).sort((a, b) => b.coste - a.coste).slice(0, 3);
  }, [nominas]);

  // Variaciones mes actual vs mes anterior (datos globales)
  const variaciones = useMemo(() => {
    if (datosGlobales.length < 2) return null;
    const ultimo = datosGlobales[datosGlobales.length - 1];
    const penultimo = datosGlobales[datosGlobales.length - 2];
    return { ultimo, penultimo };
  }, [datosGlobales]);

  if (nominas.length === 0) return null;

  return (
    <div className="space-y-5 pt-2">
      {/* Separador */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
        <h3 className="font-semibold text-sm text-foreground">Evolución histórica</h3>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Variación último mes */}
      {variaciones && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Último mes ({variaciones.ultimo.label})</p>
            <p className="text-base font-bold text-primary">{fmt(variaciones.ultimo.coste)}</p>
            <div className="mt-1">
              <VariacionBadge actual={variaciones.ultimo.coste} anterior={variaciones.penultimo.coste} />
            </div>
          </div>
          <div className="bg-muted/40 border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Nóminas registradas</p>
            <p className="text-base font-bold">{nominas.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{[...new Set(nominas.map(n => n.operario_dni || n.operario_name))].length} trabajadores</p>
          </div>
        </div>
      )}

      {/* Selector de trabajador */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTrabajadorSeleccionado(null)}
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold border transition-all
            ${!trabajadorSeleccionado
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
        >
          Empresa total
        </button>
        {trabajadores.map(t => (
          <button
            key={t.key}
            onClick={() => setTrabajadorSeleccionado(trabajadorSeleccionado === t.key ? null : t.key)}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold border transition-all
              ${trabajadorSeleccionado === t.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            <User className="w-3 h-3 shrink-0" />
            {t.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Gráfico de línea — tendencia */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">
          {nombreTrabajador ? `Historial: ${nombreTrabajador}` : 'Coste empresa · Evolución mensual'}
        </p>
        {datosGrafico.length < 2 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Necesitas al menos 2 meses de datos para ver la tendencia.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={datosGrafico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="coste" name="Coste empresa" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="liquido" name="Líquido" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de barras — comparativa mensual */}
      {datosGrafico.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Comparativa mensual (barras)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={datosGrafico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="coste" name="Coste empresa" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="liquido" name="Líquido" fill="#16a34a" radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top 3 trabajadores */}
      {top3.length > 0 && !trabajadorSeleccionado && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top coste acumulado</p>
          <div className="space-y-2">
            {top3.map((t, i) => {
              const maxCoste = top3[0].coste;
              const pct = maxCoste > 0 ? (t.coste / maxCoste) * 100 : 0;
              return (
                <button
                  key={t.key}
                  onClick={() => setTrabajadorSeleccionado(t.key)}
                  className="w-full flex items-center gap-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-xl px-3 py-2.5 transition-colors text-left"
                >
                  <span className={`text-xs font-bold w-5 shrink-0 ${i === 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{t.name}</p>
                    <div className="h-1.5 bg-border rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">{fmt(t.coste)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}