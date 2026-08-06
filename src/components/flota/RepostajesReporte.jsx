import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel, MapPin, User, Calendar, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const PERIODOS = [
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'anual', label: 'Anual' },
];

function clavePeriodo(fechaISO, periodo) {
  const d = parseISO(fechaISO);
  if (periodo === 'anual') return format(d, 'yyyy');
  if (periodo === 'mensual') return format(d, 'yyyy-MM');
  // semanal: lunes de esa semana
  const semIni = startOfWeek(d, { weekStartsOn: 1 });
  return format(semIni, 'yyyy-MM-dd');
}

function etiquetaPeriodo(clave, periodo) {
  if (periodo === 'anual') return `Año ${clave}`;
  if (periodo === 'mensual') {
    const [y, m] = clave.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return format(d, 'MMMM yyyy', { locale: es });
  }
  const semIni = parseISO(clave);
  const semFin = endOfWeek(semIni, { weekStartsOn: 1 });
  return `Sem. ${format(semIni, 'dd/MM', { locale: es })} — ${format(semFin, 'dd/MM/yyyy', { locale: es })}`;
}

export default function RepostajesReporte() {
  const [periodo, setPeriodo] = useState('mensual');

  const { data: repostajes = [], isLoading } = useQuery({
    queryKey: ['repostajes-historico'],
    queryFn: () => base44.entities.AlertaVehiculo.filter({ tipo: 'repostaje' }, '-fecha', 500),
  });

  // Repostajes del periodo actual (el más reciente con datos)
  const { grupos, periodoActual } = useMemo(() => {
    const gruposMap = new Map();
    for (const r of repostajes) {
      const k = clavePeriodo(r.fecha, periodo);
      if (!gruposMap.has(k)) gruposMap.set(k, []);
      gruposMap.get(k).push(r);
    }
    const claves = [...gruposMap.keys()].sort().reverse();
    return {
      grupos: claves.length > 0
        ? [{ clave: claves[0], items: gruposMap.get(claves[0]), count: gruposMap.get(claves[0]).length }]
        : [],
      periodoActual: claves.length > 0 ? { clave: claves[0], count: gruposMap.get(claves[0]).length, total: gruposMap.get(claves[0]).length } : null,
    };
  }, [repostajes, periodo]);

  // Resumen histórico por periodo
  const historico = useMemo(() => {
    const map = new Map();
    for (const r of repostajes) {
      const k = clavePeriodo(r.fecha, periodo);
      const entry = map.get(k) || { clave: k, count: 0, tecnicos: new Set(), lugares: new Map() };
      entry.count++;
      if (r.reportada_por_nombre) entry.tecnicos.add(r.reportada_por_nombre);
      if (r.lugar) entry.lugares.set(r.lugar, (entry.lugares.get(r.lugar) || 0) + 1);
      map.set(k, entry);
    }
    return [...map.values()]
      .map(e => ({ ...e, tecnicos: e.tecnicos.size, lugares: Object.fromEntries(e.lugares) }))
      .sort((a, b) => a.clave < b.clave ? 1 : -1);
  }, [repostajes, periodo]);

  const totalGlobal = repostajes.length;
  const descarga = () => {
    const csv = ['fecha,matricula,tecnico,lugar,modelo']
      .concat(repostajes.map(r => `"${r.fecha || ''}","${r.vehiculo_matricula || ''}","${r.reportada_por_nombre || ''}","${r.lugar || ''}","${r.vehiculo_modelo || ''}"`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `repostajes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const activos = repostajes.filter(r => r.avisos_visible !== false).length;

  return (
    <div className="space-y-4">
      {/* Selector periodo + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {PERIODOS.map(p => (
            <Button
              key={p.id}
              size="sm"
              variant={periodo === p.id ? 'default' : 'outline'}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={descarga}>
          ⬇ Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{totalGlobal}</p>
          <p className="text-xs text-muted-foreground">Repostajes totales</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{activos}</p>
          <p className="text-xs text-muted-foreground">Avisos hoy (activos)</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{periodoActual?.count ?? 0}</p>
          <p className="text-xs text-muted-foreground">{PERIODOS.find(p => p.id === periodo)?.label} actual</p>
        </Card>
      </div>

      {/* Detalle del periodo actual */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
      ) : grupos.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground text-sm">Sin repostajes registrados.</Card>
      ) : (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            {etiquetaPeriodo(grupos[0].clave, periodo)} — {grupos[0].count} repostaje(s)
          </h4>
          <div className="space-y-2">
            {grupos[0].items.map(r => (
              <Card key={r.id} className="p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                      <Fuel className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{r.vehiculo_matricula} {r.vehiculo_modelo && <span className="text-muted-foreground font-normal">· {r.vehiculo_modelo}</span>}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.reportada_por_nombre || '—'}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.lugar || '—'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{r.fecha && format(parseISO(r.fecha), 'dd/MM/yyyy', { locale: es })}</p>
                    {r.avisos_visible === false
                      ? <Badge variant="outline" className="text-xs">Archivado</Badge>
                      : <Badge className="text-xs bg-green-100 text-green-700">Activo</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Resumen histórico */}
          {historico.length > 1 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Histórico por {PERIODOS.find(p => p.id === periodo)?.label.toLowerCase()}</h4>
              <div className="space-y-1.5">
                {historico.map(h => (
                  <div key={h.clave} className="flex items-center justify-between text-sm border-b border-border/50 py-1.5">
                    <span>{etiquetaPeriodo(h.clave, periodo)}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{h.count} repostaje(s)</Badge>
                      <span className="text-xs text-muted-foreground">{h.tecnicos} técnico(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}