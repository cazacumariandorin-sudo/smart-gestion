/**
 * RegularizacionPeriodo — Vista de regularización de saldos acumulados por
 * periodo (trimestre / semestre / anual). Para cada operario muestra:
 *   total justificado − total pagado − total adelantos = saldo pendiente
 * Incluye los gastos tardíos (es_gasto_tardio) sumados al periodo al que
 * pertenecen por su ciclo_mes.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Banknote, Scale, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subPeriodosDe, enPeriodo, etiquetaPeriodo } from '@/lib/periodosRegularizacion';

const eur = (n) => `${(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const ESTADOS_JUSTIFICADOS = ['aprobado_gerencia', 'en_administracion', 'pagada'];

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

export default function RegularizacionPeriodo({
  registros = [],
  adelantos = [],
  periodo,
  subPeriodo,
  anio,
}) {
  // Acumulado del periodo completo (todos los subperiodos del año que coincidan)
  // Si subPeriodo es null → acumulado anual completo; si no, solo ese subperiodo.
  const registrosPeriodo = useMemo(
    () => registros.filter(r => enPeriodo(r.ciclo_mes, anio, periodo, subPeriodo)),
    [registros, anio, periodo, subPeriodo],
  );

  const justificados = useMemo(
    () => registrosPeriodo.filter(r => ESTADOS_JUSTIFICADOS.includes(r.estado)),
    [registrosPeriodo],
  );

  const adelantosPeriodo = useMemo(
    () => adelantos.filter(a => enPeriodo(a.ciclo_mes, anio, periodo, subPeriodo)),
    [adelantos, anio, periodo, subPeriodo],
  );

  // Saldos por operario
  const porOperario = useMemo(() => {
    const map = {};
    const add = (op, r) => {
      if (!map[op]) map[op] = { operario: op, justificado: 0, pagado: 0, tardios: 0, count: 0 };
      map[op].justificado += r.importe || 0;
      map[op].count += 1;
      if (r.es_gasto_tardio) map[op].tardios += r.importe || 0;
      if (r.estado === 'pagada') map[op].pagado += r.importe_pagado_real || r.importe || 0;
    };
    for (const r of justificados) add(r.operario_name || 'Sin operario', r);
    for (const a of adelantosPeriodo) {
      const op = a.operario_name || 'Sin operario';
      if (!map[op]) map[op] = { operario: op, justificado: 0, pagado: 0, tardios: 0, count: 0 };
      map[op].adelanto = (map[op].adelanto || 0) + (a.importe || 0);
    }
    return Object.values(map)
      .map(g => ({
        ...g,
        adelanto: g.adelanto || 0,
        saldo: g.justificado - g.pagado - (g.adelanto || 0),
      }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [justificados, adelantosPeriodo]);

  const totalJustificado = porOperario.reduce((s, o) => s + o.justificado, 0);
  const totalPagado = porOperario.reduce((s, o) => s + o.pagado, 0);
  const totalAdelantos = porOperario.reduce((s, o) => s + o.adelanto, 0);
  const saldoPendiente = totalJustificado - totalPagado - totalAdelantos;
  const totalTardios = porOperario.reduce((s, o) => s + o.tardios, 0);

  const subLabel = subPeriodo
    ? etiquetaPeriodo(periodo, subPeriodo, anio)
    : `Acumulado anual ${anio}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Scale className="w-4 h-4 text-primary" /> Regularización de saldos — {subLabel}
      </div>

      {/* KPIs acumulados */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Wallet} label="Justificado acumulado" value={eur(totalJustificado)} color="bg-orange-100 text-orange-600" />
        <KpiCard icon={Banknote} label="Pagado acumulado" value={eur(totalPagado)} color="bg-emerald-100 text-emerald-600" />
        <KpiCard icon={AlertCircle} label="Adelantos acumulados" value={eur(totalAdelantos)} color="bg-purple-100 text-purple-600" />
        <KpiCard
          icon={Scale}
          label="Saldo pendiente regularización"
          value={eur(saldoPendiente)}
          color={saldoPendiente > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
        />
        <KpiCard icon={Clock} label="Gastos tardíos acumulados" value={eur(totalTardios)} color="bg-blue-100 text-blue-600" />
      </div>

      {/* Tabla por operario */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Saldos por operario</p>
            <p className="text-xs text-muted-foreground">
              Justificado − Pagado − Adelantos = Saldo pendiente de regularización
            </p>
          </div>
          {porOperario.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay gastos justificados ni adelantos en este periodo.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {/* Cabecera (desktop) */}
              <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Operario</span>
                <span className="text-right">Justificado</span>
                <span className="text-right">Pagado</span>
                <span className="text-right">Adelantos</span>
                <span className="text-right">Tardíos</span>
                <span className="text-right">Saldo regularización</span>
              </div>
              {porOperario.map(o => (
                <div
                  key={o.operario}
                  className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-3 text-sm items-center"
                >
                  <span className="font-medium truncate col-span-2 sm:col-span-1">{o.operario}</span>
                  <span className="text-right">{eur(o.justificado)}</span>
                  <span className="text-right text-emerald-600">{eur(o.pagado)}</span>
                  <span className="text-right text-purple-600">{eur(o.adelanto)}</span>
                  <span className="text-right">
                    {o.tardios > 0 ? (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                        <Clock className="w-3 h-3 mr-1" />{eur(o.tardios)}
                      </Badge>
                    ) : '—'}
                  </span>
                  <span className={`text-right font-semibold ${o.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {o.saldo === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Regularizado</span>
                    ) : (
                      eur(o.saldo)
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota explicativa */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-xs text-blue-800 dark:text-blue-300">
        <p className="flex items-start gap-2">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          Los <strong>gastos tardíos</strong> (justificantes presentados con más de 30 días de retraso)
          se incluyen en el periodo al que pertenecen por su ciclo mensual (campo <code>ciclo_mes</code>),
          no en el mes de registro. Esto permite que la regularización refleje el coste real del periodo.
        </p>
      </div>
    </div>
  );
}