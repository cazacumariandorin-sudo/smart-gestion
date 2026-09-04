import React, { useMemo } from 'react';
import { CalendarClock, CalendarDays, AlertTriangle, History, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function calcularCiclo(fecha) {
  // El ciclo que está activo HOY:
  //  - Día 1..25  → ciclo del mes en curso (abierto el día 26 del mes anterior).
  //  - Día 26..31 → ciclo del mes siguiente (abierto hoy, el anterior ya cerró el 25).
  const y = fecha.getFullYear();
  const m = fecha.getMonth();
  const d = fecha.getDate();
  let cicloY, cicloM;
  if (d >= 26) {
    cicloY = m === 11 ? y + 1 : y;
    cicloM = m === 11 ? 0 : m + 1;
  } else {
    cicloY = y;
    cicloM = m;
  }
  const apY = cicloM === 0 ? cicloY - 1 : cicloY;
  const apM = cicloM === 0 ? 11 : cicloM - 1;
  const cierre = new Date(cicloY, cicloM, 25);
  const apertura = new Date(apY, apM, 26);
  return {
    cicloMes: `${cicloY}-${String(cicloM + 1).padStart(2, '0')}`,
    apertura,
    cierre,
    cicloYLit: `${apertura.getDate()} ${MESES_ES[apertura.getMonth()]} → ${cierre.getDate()} ${MESES_ES[cierre.getMonth()]} ${cierre.getFullYear()}`,
  };
}

/**
 * Calcula la info de un ciclo cualquiera a partir de su clave "YYYY-MM".
 * La apertura es el día 26 del mes anterior; el cierre el día 25 del mes del ciclo.
 */
function infoCicloPorMes(cicloMes) {
  const [y, m] = cicloMes.split('-').map(Number);
  const cierre = new Date(y, m - 1, 25);
  const apY = m === 1 ? y - 1 : y;
  const apM = m === 1 ? 11 : m - 2; // 0-based: mes anterior al ciclo
  const apertura = new Date(apY, apM, 26);
  return {
    cicloMes,
    apertura,
    cierre,
    cicloYLit: `${apertura.getDate()} ${MESES_ES[apertura.getMonth()]} → ${cierre.getDate()} ${MESES_ES[cierre.getMonth()]} ${cierre.getFullYear()}`,
  };
}

export { calcularCiclo, infoCicloPorMes };

/**
 * Banner informativo del ciclo de gasto activo (modelo 26→25).
 *
 * Props opcionales para permitir cambiar de ciclo (gerencia / administración):
 *  - cicloMes: clave "YYYY-MM" del ciclo a mostrar (o "todos"). Si se omite, muestra el activo.
 *  - ciclosDisponibles: array de claves "YYYY-MM" para el selector.
 *  - onCicloChange: callback(cicloMes) al cambiar la selección.
 *  - permitirCambiar: si true y hay >1 ciclo disponible, renderiza el selector.
 */
export default function BannerCicloActivo({
  className,
  cicloMes,
  ciclosDisponibles,
  onCicloChange,
  permitirCambiar,
}) {
  const activo = useMemo(() => calcularCiclo(new Date()), []);
  const esTodos = cicloMes === 'todos';
  const cicloInfo = esTodos ? null : (cicloMes ? infoCicloPorMes(cicloMes) : activo);
  const esActivo = !cicloMes || cicloMes === activo.cicloMes;

  const hoy = new Date();
  const diasRestantes = esActivo && cicloInfo
    ? Math.max(0, Math.ceil((cicloInfo.cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const diaHoy = hoy.getDate();
  const avisoCierre = esActivo && diaHoy >= 22 && diaHoy <= 24;
  const cicloRecienAbierto = esActivo && diaHoy >= 26 && diaHoy <= 31;
  const cicloCerrado = !esActivo && cicloInfo && cicloInfo.cierre.getTime() < hoy.getTime();

  const variant = esTodos
    ? 'blue'
    : !esActivo
      ? 'slate'
      : avisoCierre
        ? 'amber'
        : cicloRecienAbierto
          ? 'blue'
          : 'neutral';

  const variantClasses = {
    amber: 'bg-amber-50/80 border-amber-200 text-amber-900',
    blue: 'bg-blue-50/80 border-blue-200 text-blue-900',
    neutral: 'bg-slate-50/80 border-slate-200 text-slate-800',
    slate: 'bg-slate-100/80 border-slate-300 text-slate-700',
  }[variant];

  const Icono = esTodos ? Layers : !esActivo ? History : avisoCierre ? AlertTriangle : cicloRecienAbierto ? CalendarDays : CalendarClock;

  const subTexto = esTodos
    ? 'Mostrando registros de todos los periodos. Usa el selector para acotar por ciclo.'
    : !esActivo
      ? (cicloCerrado ? 'Ciclo ya cerrado. Revisa los registros pendientes de validación de este periodo.' : 'Ciclo futuro.')
      : avisoCierre
        ? `Cierre inminente: faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} hasta el día 25. Valida tus registros antes del cierre.`
        : cicloRecienAbierto
          ? `Ciclo recién abierto. A partir de hoy (día 26) los registros entran en este ciclo.`
          : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el cierre (25 de ${MESES_ES[cicloInfo.cierre.getMonth()]}).`;

  const mostrarSelector = permitirCambiar && ciclosDisponibles && ciclosDisponibles.length > 1;
  const valorSelector = cicloMes || activo.cicloMes;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex items-start gap-3',
        variantClasses,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mt-0.5 shrink-0">
        <Icono className={cn('w-5 h-5', esTodos ? 'text-blue-600' : !esActivo ? 'text-slate-500' : avisoCierre ? 'text-amber-600' : 'text-slate-600')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">
            {esTodos ? 'Todos los ciclos' : esActivo ? 'Ciclo de gasto activo' : 'Ciclo seleccionado'}
          </span>
          {!esTodos && cicloInfo && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/70 border border-current/10 font-mono">
              {cicloInfo.cicloMes}
            </span>
          )}
          {avisoCierre && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-semibold uppercase tracking-wide">
              Cierre inminente
            </span>
          )}
          {!esActivo && !esTodos && cicloCerrado && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold uppercase tracking-wide">
              Cerrado
            </span>
          )}
        </div>
        {!esTodos && cicloInfo && (
          <div className="text-sm mt-0.5">{cicloInfo.cicloYLit}</div>
        )}
        <div className="text-xs opacity-80 mt-0.5">{subTexto}</div>

        {mostrarSelector && (
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs font-medium opacity-70">Ver ciclo:</label>
            <select
              value={valorSelector}
              onChange={e => onCicloChange?.(e.target.value)}
              className="text-xs rounded-md border border-current/20 bg-white/80 px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring min-h-0"
            >
              <option value={activo.cicloMes}>{activo.cicloMes} (activo)</option>
              <option value="todos">Todos los ciclos</option>
              {ciclosDisponibles.filter(c => c !== activo.cicloMes).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}