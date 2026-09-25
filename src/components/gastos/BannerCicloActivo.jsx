import React, { useMemo } from 'react';
import { CalendarClock, CalendarDays, AlertTriangle, History, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function ultimoDiaDelMes(y, m) {
  // y, m en base 1; new Date(y, m, 0) → último día del mes m
  return new Date(y, m, 0).getDate();
}

// El ciclo de gasto es 26→25: del día 26 del mes anterior al día 25 del mes del ciclo.
// Ej.: ciclo "2026-09" = 26 ago 2026 → 25 sep 2026.
function calcularCiclo(fecha) {
  const y = fecha.getFullYear();
  const m = fecha.getMonth(); // 0-based
  const d = fecha.getDate();
  let cicloYear, cicloMonthIdx, apertura, cierre;
  if (d >= 26) {
    // A partir del día 26, el ciclo activo es el mes siguiente.
    cicloMonthIdx = m + 1;
    cicloYear = y;
    if (cicloMonthIdx > 11) { cicloMonthIdx = 0; cicloYear = y + 1; }
    apertura = new Date(y, m, 26);
    cierre = new Date(cicloYear, cicloMonthIdx, 25);
  } else {
    // Del 1 al 25, el ciclo activo es el mes en curso.
    cicloMonthIdx = m;
    cicloYear = y;
    const apY = m === 0 ? y - 1 : y;
    const apM = m === 0 ? 11 : m - 1;
    apertura = new Date(apY, apM, 26);
    cierre = new Date(y, m, 25);
  }
  const cicloMes = `${cicloYear}-${String(cicloMonthIdx + 1).padStart(2, '0')}`;
  const diasRestantes = Math.max(0, Math.ceil((cierre.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    cicloMes,
    apertura,
    cierre,
    diasRestantes,
    esUltimoDia: d === cierre.getDate() && m === cierre.getMonth() && y === cierre.getFullYear(),
    esPrimerDia: d === 26,
    cicloYLit: `${apertura.getDate()} ${MESES_ES[apertura.getMonth()]} → ${cierre.getDate()} ${MESES_ES[cierre.getMonth()]} ${cicloYear}`,
  };
}

/**
 * Calcula la info de un ciclo cualquiera a partir de su clave "YYYY-MM".
 * Modelo 26→25: apertura = 26 del mes anterior, cierre = 25 del mes del ciclo.
 */
function infoCicloPorMes(cicloMes) {
  const [y, m] = cicloMes.split('-').map(Number); // m 1-based
  const cierre = new Date(y, m - 1, 25); // 25 del mes del ciclo
  const apY = m === 1 ? y - 1 : y;
  const apM = m === 1 ? 11 : m - 2; // 0-based del mes anterior
  const apertura = new Date(apY, apM, 26);
  return {
    cicloMes,
    apertura,
    cierre,
    diasRestantes: null,
    cicloYLit: `${apertura.getDate()} ${MESES_ES[apertura.getMonth()]} → ${cierre.getDate()} ${MESES_ES[cierre.getMonth()]} ${y}`,
  };
}

export { calcularCiclo, infoCicloPorMes, ultimoDiaDelMes };

/**
 * Banner informativo del ciclo de gasto activo (modelo 26→25: del 26 del mes
 * anterior al 25 del mes del ciclo).
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
  const diasAlCierre = esActivo && cicloInfo ? Math.max(0, Math.ceil((cicloInfo.cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const diasDesdeApertura = esActivo && cicloInfo ? Math.floor((hoy.getTime() - cicloInfo.apertura.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const avisoCierre = esActivo && diasAlCierre <= 3 && diasAlCierre > 0;
  const cicloRecienAbierto = esActivo && diasDesdeApertura <= 3;
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
        ? `Cierre inminente: faltan ${diasAlCierre} día${diasAlCierre === 1 ? '' : 's'} hasta el ${cicloInfo.cierre.getDate()} de ${MESES_ES[cicloInfo.cierre.getMonth()]}. Valida tus registros antes del cierre.`
        : cicloRecienAbierto
          ? `Ciclo recién abierto (26 de ${MESES_ES[cicloInfo.apertura.getMonth()]}). Los registros entran en este ciclo (26→25).`
          : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el cierre (${cicloInfo.cierre.getDate()} de ${MESES_ES[cicloInfo.cierre.getMonth()]}).`;

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