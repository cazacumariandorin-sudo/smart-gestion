import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart2, Download, TrendingUp, Users, Euro, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ANIOS = [2024, 2025, 2026, 2027];

function fmt(n) {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function AnalisisCostes() {
  const [mesDesde, setMesDesde] = useState(1);
  const [mesHasta, setMesHasta] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [exportando, setExportando] = useState(false);

  const { data: nominas = [], isLoading } = useQuery({
    queryKey: ['nominas-costes'],
    queryFn: () => base44.entities.Nomina.list('-anio', 1000),
  });

  // Filtrar por período seleccionado
  const nominasFiltradas = useMemo(() =>
    nominas.filter(n =>
      n.anio === anio &&
      n.mes >= mesDesde &&
      n.mes <= mesHasta
    ), [nominas, anio, mesDesde, mesHasta]);

  // Agrupar por trabajador
  const porTrabajador = useMemo(() => {
    const map = {};
    for (const nom of nominasFiltradas) {
      const key = nom.operario_dni || nom.operario_name || nom.id;
      if (!map[key]) {
        map[key] = {
          name: nom.operario_name || 'Sin nombre',
          dni: nom.operario_dni || '—',
          meses: {},
          total_coste: 0,
          total_liquido: 0,
          total_devengado: 0,
          num_nominas: 0,
        };
      }
      map[key].total_coste += nom.coste_empresa || 0;
      map[key].total_liquido += nom.liquido_percibir || 0;
      map[key].total_devengado += nom.total_devengado || 0;
      map[key].num_nominas += 1;
      map[key].meses[nom.mes] = {
        coste: nom.coste_empresa,
        liquido: nom.liquido_percibir,
      };
    }
    return Object.values(map).sort((a, b) => b.total_coste - a.total_coste);
  }, [nominasFiltradas]);

  // Totales globales
  const totales = useMemo(() => ({
    coste: porTrabajador.reduce((s, t) => s + t.total_coste, 0),
    liquido: porTrabajador.reduce((s, t) => s + t.total_liquido, 0),
    devengado: porTrabajador.reduce((s, t) => s + t.total_devengado, 0),
  }), [porTrabajador]);

  // Columnas de meses en el rango
  const mesesRango = [];
  for (let m = mesDesde; m <= mesHasta; m++) mesesRango.push(m);

  const exportarCSV = () => {
    setExportando(true);
    const periodoLabel = mesDesde === mesHasta
      ? `${MESES[mesDesde]} ${anio}`
      : `${MESES[mesDesde]}-${MESES[mesHasta]} ${anio}`;

    const cabecera = ['Trabajador', 'DNI', ...mesesRango.map(m => `Coste ${MESES[m]}`), 'Total Coste Empresa', 'Total Líquido', 'Total Devengado'];
    const filas = porTrabajador.map(t => [
      t.name,
      t.dni,
      ...mesesRango.map(m => t.meses[m]?.coste?.toFixed(2) ?? ''),
      t.total_coste.toFixed(2),
      t.total_liquido.toFixed(2),
      t.total_devengado.toFixed(2),
    ]);
    filas.push([
      'TOTAL', '',
      ...mesesRango.map(() => ''),
      totales.coste.toFixed(2),
      totales.liquido.toFixed(2),
      totales.devengado.toFixed(2),
    ]);

    const csvContent = [cabecera, ...filas]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Resumen_Costes_${periodoLabel.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  };

  const periodoLabel = mesDesde === mesHasta
    ? `${MESES[mesDesde]} ${anio}`
    : `${MESES[mesDesde]} – ${MESES[mesHasta]} ${anio}`;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">Análisis de costes</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-9 text-xs"
          onClick={exportarCSV}
          disabled={exportando || porTrabajador.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros de período */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Año</label>
          <select value={anio} onChange={e => setAnio(parseInt(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Desde</label>
          <select value={mesDesde} onChange={e => { const v = parseInt(e.target.value); setMesDesde(v); if (v > mesHasta) setMesHasta(v); }}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Hasta</label>
          <select value={mesHasta} onChange={e => { const v = parseInt(e.target.value); setMesHasta(v); if (v < mesDesde) setMesDesde(v); }}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Coste empresa
            </p>
            <p className="text-lg font-bold text-primary mt-1">{fmt(totales.coste)}</p>
            <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center justify-center gap-1">
              <Euro className="w-3 h-3" /> Líquido total
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">{fmt(totales.liquido)}</p>
            <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> Trabajadores
            </p>
            <p className="text-lg font-bold mt-1">{porTrabajador.length}</p>
            <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : porTrabajador.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay datos para el período seleccionado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Trabajador</th>
                {mesesRango.length > 1 && mesesRango.map(m => (
                  <th key={m} className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{MESES[m]}</th>
                ))}
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Total coste</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {porTrabajador.map((t, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.dni}</p>
                  </td>
                  {mesesRango.length > 1 && mesesRango.map(m => (
                    <td key={m} className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                      {t.meses[m]?.coste != null ? fmt(t.meses[m].coste) : <span className="opacity-30">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-bold text-primary text-sm">{fmt(t.total_coste)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-green-700 dark:text-green-400">
                    {fmt(t.total_liquido)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border font-bold">
                <td className="px-4 py-2.5 text-sm">TOTAL</td>
                {mesesRango.length > 1 && mesesRango.map(m => (
                  <td key={m} className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {fmt(nominasFiltradas.filter(n => n.mes === m).reduce((s, n) => s + (n.coste_empresa || 0), 0))}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right text-primary">{fmt(totales.coste)}</td>
                <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-400 text-xs">{fmt(totales.liquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Nota informativa */}
      {porTrabajador.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Calendar className="w-3 h-3" />
          Datos de {nominasFiltradas.length} nómina{nominasFiltradas.length !== 1 ? 's' : ''} en el período · El CSV incluye el desglose mensual completo
        </p>
      )}
    </div>
  );
}