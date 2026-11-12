import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, History, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const euro = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

function getSixCompletedMonths(now = new Date()) {
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(firstThisMonth.getFullYear(), firstThisMonth.getMonth() - 1, 1);
  const firstMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 5, 1);
  const months = [];
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
    months.push({ anio: date.getFullYear(), mes: date.getMonth() + 1, key: monthKey(date.getFullYear(), date.getMonth() + 1) });
  }
  return {
    months,
    desde: monthKey(firstMonth.getFullYear(), firstMonth.getMonth() + 1),
    hasta: monthKey(lastMonth.getFullYear(), lastMonth.getMonth() + 1),
  };
}

function countWeekdays(startKey, endKey) {
  const [startYear, startMonth] = startKey.split('-').map(Number);
  const [endYear, endMonth] = endKey.split('-').map(Number);
  const date = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonth, 0));
  let count = 0;
  while (date <= end) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return count;
}

function payrollMonth(n) {
  const year = Number(n.anio);
  const month = Number(n.mes);
  return year > 0 && month >= 1 && month <= 12 ? monthKey(year, month) : null;
}

function deduplicatePayrolls(records) {
  const byPersonMonth = new Map();
  for (const record of records) {
    if (record.tipo_documento !== 'nomina_individual') continue;
    const month = payrollMonth(record);
    const cost = Number(record.coste_empresa);
    if (!month || !Number.isFinite(cost) || cost < 0) continue;
    const person = record.operario_dni || record.operario_id || record.operario_name || record.id;
    if (!person) continue;
    const key = `${person}::${month}`;
    const current = byPersonMonth.get(key);
    // Si hay más de una carga para la misma persona/mes, conservar la más reciente.
    const timestamp = new Date(record.updated_date || record.created_date || 0).getTime() || 0;
    const currentTimestamp = current ? (new Date(current.updated_date || current.created_date || 0).getTime() || 0) : -1;
    if (!current || timestamp >= currentTimestamp) byPersonMonth.set(key, record);
  }
  return [...byPersonMonth.values()];
}

export default function RevisionCosteDiario() {
  const { user, role } = useUserRole();
  const qc = useQueryClient();
  const puedeConsultar = ['admin', 'propietario', 'gerencia', 'administracion'].includes(role);
  const puedeAprobar = ['admin', 'propietario', 'gerencia'].includes(role);
  const periodo = useMemo(() => getSixCompletedMonths(), []);
  const [verHistorial, setVerHistorial] = useState(false);

  const { data: nominas = [], isLoading: loadingNominas } = useQuery({
    queryKey: ['nominas-revision-coste-diario'],
    queryFn: () => base44.entities.Nomina.list('-anio', 2000),
    enabled: puedeConsultar,
  });
  const { data: empresas = [], isLoading: loadingEmpresa } = useQuery({
    queryKey: ['empresa-revision-coste-diario'],
    queryFn: () => base44.entities.Empresa.list('-created_date', 100),
    enabled: puedeConsultar,
  });
  const empresa = empresas.find((item) => item.es_principal) || empresas.find((item) => item.activa !== false) || empresas[0] || null;
  const historial = Array.isArray(empresa?.coste_laboral_revisiones) ? empresa.coste_laboral_revisiones : [];

  const calculo = useMemo(() => {
    const mesesValidos = new Set(periodo.months.map((m) => m.key));
    const registros = deduplicatePayrolls(nominas).filter((n) => mesesValidos.has(payrollMonth(n)));
    const mesesConDatos = new Set(registros.map(payrollMonth));
    const mesesFaltantes = periodo.months.filter((m) => !mesesConDatos.has(m.key));
    const costeTotal = round2(registros.reduce((sum, n) => sum + Number(n.coste_empresa || 0), 0));
    const diasLaborables = countWeekdays(periodo.desde, periodo.hasta);
    const trabajadores = new Set(registros.map((n) => n.operario_dni || n.operario_id || n.operario_name || n.id)).size;
    const costeDiario = diasLaborables > 0 ? round2(costeTotal / diasLaborables) : null;
    const costeMensual = periodo.months.map((m) => ({
      periodo: m.key,
      coste: round2(registros.filter((n) => payrollMonth(n) === m.key).reduce((sum, n) => sum + Number(n.coste_empresa || 0), 0)),
    }));
    return { registros, mesesFaltantes, costeTotal, diasLaborables, trabajadores, costeDiario, costeMensual };
  }, [nominas, periodo]);

  const ultimaRevision = [...historial].sort((a, b) => new Date(b.fecha_revision || 0) - new Date(a.fecha_revision || 0))[0] || null;
  const proximaRevision = ultimaRevision?.proxima_revision ? new Date(ultimaRevision.proxima_revision) : null;
  const vencida = !ultimaRevision || !proximaRevision || proximaRevision <= new Date();
  const periodoLabel = `${MONTHS[periodo.months[0].mes - 1]} ${periodo.months[0].anio} – ${MONTHS[periodo.months[5].mes - 1]} ${periodo.months[5].anio}`;
  const puedeGuardar = calculo.registros.length > 0 && calculo.costeTotal > 0 && calculo.mesesFaltantes.length === 0 && !loadingNominas && !loadingEmpresa && !!empresa && puedeAprobar;

  const guardarRevision = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error('No hay una ficha de empresa disponible.');
      if (!puedeAprobar) throw new Error('Solo Gerencia puede aprobar la revisión.');
      if (calculo.mesesFaltantes.length) throw new Error('Faltan nóminas individuales en uno o más meses del semestre.');
      if (calculo.costeTotal <= 0 || calculo.diasLaborables <= 0) throw new Error('No hay datos suficientes para calcular el coste diario.');
      const fecha = new Date();
      const proxima = new Date(fecha);
      proxima.setMonth(proxima.getMonth() + 6);
      const revision = {
        id: `coste-${fecha.getTime()}`,
        fecha_revision: fecha.toISOString(),
        periodo_desde: periodo.desde,
        periodo_hasta: periodo.hasta,
        tipo_dia: 'laborable',
        metodo: 'coste empresa acumulado de nóminas individuales / días laborables de lunes a viernes',
        total_coste_empresa: calculo.costeTotal,
        dias_laborables: calculo.diasLaborables,
        coste_diario: calculo.costeDiario,
        num_nominas: calculo.registros.length,
        num_trabajadores: calculo.trabajadores,
        ids_nominas: calculo.registros.map((n) => n.id),
        coste_por_mes: calculo.costeMensual,
        aprobado_por: user?.email || user?.full_name || 'Gerencia',
        aprobado_por_nombre: user?.full_name || user?.email || 'Gerencia',
        estado: 'aprobado',
        proxima_revision: proxima.toISOString(),
      };
      const versiones = [...historial, revision];
      await base44.entities.Empresa.update(empresa.id, {
        coste_laboral_revisiones: versiones,
        coste_laboral_revision_actual: revision,
      });
      return revision;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresa-revision-coste-diario'] });
      toast.success('Revisión semestral aprobada y guardada.');
    },
    onError: (error) => toast.error(error.message || 'No se pudo guardar la revisión.'),
  });

  if (!puedeConsultar) return null;
  if (loadingNominas || loadingEmpresa) return <div className="flex items-center justify-center py-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando coste laboral…</div>;

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" />Coste laboral diario · revisión semestral</h3>
          <p className="mt-1 text-xs text-muted-foreground">Periodo: {periodoLabel}. Coste de nóminas reales individuales dividido por días laborables (lunes a viernes); no descuenta festivos, vacaciones ni bajas.</p>
        </div>
        {puedeAprobar && <Button size="sm" onClick={() => guardarRevision.mutate()} disabled={!puedeGuardar || guardarRevision.isPending}>
          {guardarRevision.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
          Aprobar revisión
        </Button>}
      </div>

      {ultimaRevision && <div className={`rounded-lg border p-3 text-sm ${vencida ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/20' : 'border-green-200 bg-green-50 text-green-900 dark:bg-green-950/20'}`}>
        <div className="flex items-center gap-2 font-medium">{vencida ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {vencida ? 'Revisión semestral pendiente' : 'Revisión semestral vigente'}
        </div>
        <p className="mt-1 text-xs">Última aprobación: {new Date(ultimaRevision.fecha_revision).toLocaleDateString('es-ES')} · {ultimaRevision.aprobado_por_nombre || ultimaRevision.aprobado_por} · Próxima revisión: {proximaRevision?.toLocaleDateString('es-ES') || '—'} · Coste diario aprobado: {euro(ultimaRevision.coste_diario)}</p>
      </div>}

      {!empresa && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No hay ficha de empresa para guardar las revisiones.</div>}
      {calculo.mesesFaltantes.length > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20">
        <div className="font-medium">Revisión no disponible: faltan nóminas individuales para cubrir los seis meses completos.</div>
        <div className="mt-1">Meses sin datos: {calculo.mesesFaltantes.map((m) => `${MONTHS[m.mes - 1]} ${m.anio}`).join(', ')}.</div>
      </div>}
      {calculo.registros.length === 0 ? <div className="text-sm text-muted-foreground">No hay nóminas individuales con coste de empresa para el semestre.</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Coste empresa del semestre</div><div className="mt-1 font-bold">{euro(calculo.costeTotal)}</div></div>
          <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Coste diario laborable</div><div className="mt-1 text-lg font-bold text-primary">{calculo.costeDiario == null ? '—' : euro(calculo.costeDiario)}</div></div>
          <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Días laborables (lun–vie)</div><div className="mt-1 font-bold">{calculo.diasLaborables}</div></div>
          <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Nóminas / personas incluidas</div><div className="mt-1 font-bold">{calculo.registros.length} / {calculo.trabajadores}</div></div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-[11px] text-muted-foreground">Se usan nóminas `nomina_individual`; duplicados del mismo trabajador y mes se reducen a la carga más reciente. Es una media organizativa diaria, no una tarifa por trabajador.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setVerHistorial((v) => !v)}><History className="mr-1 h-3.5 w-3.5" />Historial ({historial.length})</Button>
      </div>
      {verHistorial && <div className="max-h-72 space-y-2 overflow-y-auto">
        {[...historial].sort((a, b) => new Date(b.fecha_revision || 0) - new Date(a.fecha_revision || 0)).map((revision) => <div key={revision.id || revision.fecha_revision} className="rounded-md border p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-medium"><span>{new Date(revision.fecha_revision).toLocaleString('es-ES')} · {revision.estado === 'aprobado' ? 'Aprobado' : revision.estado}</span><span>{euro(revision.coste_diario)}/día laborable</span></div>
          <div className="mt-1 text-muted-foreground">Periodo {revision.periodo_desde} – {revision.periodo_hasta} · {revision.num_nominas} nóminas · {revision.dias_laborables} días laborables · Aprobó {revision.aprobado_por_nombre || revision.aprobado_por}</div>
        </div>)}
        {!historial.length && <p className="text-xs text-muted-foreground">Aún no hay revisiones aprobadas.</p>}
      </div>}
      {puedeAprobar && calculo.mesesFaltantes.length === 0 && calculo.registros.length > 0 && <Button size="sm" variant="ghost" onClick={() => { qc.invalidateQueries({ queryKey: ['nominas-revision-coste-diario'] }); qc.invalidateQueries({ queryKey: ['empresa-revision-coste-diario'] }); }}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualizar datos</Button>}
    </section>
  );
}
