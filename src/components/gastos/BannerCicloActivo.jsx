import React, { useMemo } from 'react';
import { CalendarClock, CalendarDays, AlertTriangle, History, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function ultimoDiaDelMes(y, m) {
  // y, m en base 1; new Date(y, m, 0) → último día del mes m
  return new Date(y, m, 0).getDate();
}

// A partir de 2026-09 el ciclo es el mes de calendario completo (1 → último día real).
// Históricos pre-2026-09 mantienen el modelo 26→25 (no se recalculan aquí).
function calcularCiclo(fecha) {
  const y = fecha.getFullYear();
  const m = fecha.getMonth(); // 0-based
  const d = fecha.getDate();
  const mesHum = m + 1;
  const cierre = new Date(y, m + 1, 0); // último día real del mes
  const apertura = new Date(y, m, 1);
  const ultimoDia = cierre.getDate();
  const diasRestantes = Math.max(0, ultimoDia - d);
  return {
    cicloMes: `${y}-${String(mesHum).padStart(2, '0')}`,
    apertura,
    cierre,
    diasRestantes,
    esUltimoDia: d === ultimoDia,
    esPrimerDia: d === 1,
    cicloYLit: `1 ${MESES_ES[m]} → ${ultimoDia} ${MESES_ES[m]} ${y}`,
  };
}

/**
 * Calcula la info de un ciclo cualquiera a partir de su clave "YYYY-MM".
 * A partir de 2026-09: apertura = día 1, cierre = último día real del mes.
 * Pre-2026-09: modelo histórico 26→25 (apertura 26 mes anterior, cierre 25).
 */
function infoCicloPorMes(cicloMes) {
  const [y, m] = cicloMes.split('-').map(Number);
  const esNatural = cicloMes >= '2026-09';
  if (esNatural) {
    const cierre = new Date(y, m, 0);
    const apertura = new Date(y, m - 1, 1);
    return {
      cicloMes,
      apertura,
      cierre,
      diasRestantes: null,
      cicloYLit: `1 ${MESES_ES[apertura.getMonth()]} → ${cierre.getDate()} ${MESES_ES[cierre.getMonth()]} ${y}`,
    };
  }
  // Histórico 26→25
  const cierre = new Date(y, m - 1, 25);
  const apY = m === 1 ? y - 1 : y;
  const apM = m === 1 ? 11 : m - 2;
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
 * Banner informativo del ciclo de gasto activo (mes natural: 1 → último día real del mes).
 * Históricos pre-2026-09 conservan el modelo 26→25.
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
  const diasAlCierre = esActivo && cicloInfo ? Math.max(0, Math.ceil((cicloInfo.cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const avisoCierre = esActivo && diasAlCierre <= 3 && diasAlCierre > 0;
  const cicloRecienAbierto = esActivo && diaHoy <= 3;
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
          ? `Ciclo recién abierto (1 de ${MESES_ES[cicloInfo.apertura.getMonth()]}). Los registros del mes entran en este ciclo.`
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
            <MobileSelect
              value={valorSelector}
              onValueChange={v => onCicloChange?.(v)}
              triggerClassName="text-xs w-auto min-w-[140px]"
            >
              <MobileSelectItem value={activo.cicloMes}>{activo.cicloMes} (activo)</MobileSelectItem>
              <MobileSelectItem value="todos">Todos los ciclos</MobileSelectItem>
              {ciclosDisponibles.filter(c => c !== activo.cicloMes).map(c => (
                <MobileSelectItem key={c} value={c}>{c}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        )}
      </div>
    </div>
  );
}