import React, { useMemo } from 'react';
import { CalendarClock, CalendarDays, AlertTriangle } from 'lucide-react';
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
 * Banner informativo del ciclo de gasto activo (modelo 26→25).
 * Muestra el ciclo en vigor, los días restantes para el cierre y, si corresponde,
 * un aviso de cierre inminente (días 22-24) o ciclo recién abierto (día 26+).
 *
 * No realiza llamadas a backend — cálculo puramente local.
 */
export default function BannerCicloActivo({ className }) {
  const { apertura, cierre, cicloYLit, cicloMes } = useMemo(() => calcularCiclo(new Date()), []);
  const hoy = new Date();

  const diasRestantes = Math.max(0, Math.ceil((cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));
  const diaHoy = hoy.getDate();
  // Aviso en los días 22-24 (el cron avisaPreCierreGastos envía notificaciones estos días).
  const avisoCierre = diaHoy >= 22 && diaHoy <= 24;
  const cicloRecienAbierto = diaHoy >= 26 && diaHoy <= 31;

  const variant = avisoCierre
    ? 'amber'
    : cicloRecienAbierto
      ? 'blue'
      : 'neutral';

  const variantClasses = {
    amber: 'bg-amber-50/80 border-amber-200 text-amber-900',
    blue: 'bg-blue-50/80 border-blue-200 text-blue-900',
    neutral: 'bg-slate-50/80 border-slate-200 text-slate-800',
  }[variant];

  const Icono = avisoCierre ? AlertTriangle : cicloRecienAbierto ? CalendarDays : CalendarClock;

  const subTexto = avisoCierre
    ? `Cierre inminente: faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} hasta el día 25. Valida tus registros antes del cierre.`
    : cicloRecienAbierto
      ? `Ciclo recién abierto. A partir de hoy (día 26) los registros entran en este ciclo.`
      : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el cierre (25 de ${MESES_ES[cierre.getMonth()]}).`;

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
        <Icono className={cn('w-5 h-5', avisoCierre ? 'text-amber-600' : 'text-slate-600')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">Ciclo de gasto activo</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/70 border border-current/10 font-mono">
            {cicloMes}
          </span>
          {avisoCierre && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-semibold uppercase tracking-wide">
              Cierre inminente
            </span>
          )}
        </div>
        <div className="text-sm mt-0.5">
          {cicloYLit}
        </div>
        <div className="text-xs opacity-80 mt-0.5">{subTexto}</div>
      </div>
    </div>
  );
}