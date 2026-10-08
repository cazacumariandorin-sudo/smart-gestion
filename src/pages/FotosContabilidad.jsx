import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import FotoGastoCard from '@/components/gastos/FotoGastoCard';
import { Receipt, Camera } from 'lucide-react';
import DescargarFotosCicloButton from '@/components/gastos/DescargarFotosCicloButton';

const CATEGORIAS = ['material', 'combustible', 'peaje', 'parking', 'comida', 'otros'];
const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function labelCiclo(ciclo) {
  if (!ciclo || ciclo === 'Sin fecha') return 'Sin ciclo';
  const [y, m] = ciclo.split('-');
  const idx = parseInt(m, 10) - 1;
  return MES_LABELS[idx] ? `${MES_LABELS[idx]} ${y}` : ciclo;
}

export default function FotosContabilidad() {
  const [filtroCiclo, setFiltroCiclo] = useState('todos');
  const [filtroOperario, setFiltroOperario] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['fotos_contabilidad'],
    queryFn: () => base44.entities.RegistroGasto.list('-created_date', 9999),
  });

  // Aplana registros → un item por cada archivo adjunto
  const fotos = useMemo(() => {
    const out = [];
    for (const g of gastos) {
      const archivos = Array.isArray(g.archivos) ? g.archivos.filter(a => a?.url) : [];
      archivos.forEach((archivo, i) => {
        out.push({
          key: `${g.id}_${i}`,
          gasto_id: g.id,
          archivos_gasto: g.archivos,
          archivo,
          numero_nota: g.numero_nota,
          fecha_documento: g.fecha_documento,
          importe: g.importe,
          categoria: g.categoria,
          nombre_comercio: g.nombre_comercio,
          numero_factura: g.numero_factura,
          operario_id: g.operario_id,
          operario_name: g.operario_name,
          ciclo: g.ciclo_mes || (g.fecha_documento ? g.fecha_documento.slice(0, 7) : 'Sin fecha'),
          estado: g.estado,
        });
      });
    }
    return out;
  }, [gastos]);

  const ciclosDisponibles = useMemo(() => {
    const set = new Set(fotos.map(f => f.ciclo));
    return Array.from(set).sort().reverse();
  }, [fotos]);

  const operariosPorFiltro = useMemo(() => {
    const map = new Map();
    fotos.forEach(f => { if (f.operario_id) map.set(f.operario_id, f.operario_name || 'Operario'); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [fotos]);

  const filtradas = useMemo(() => {
    return fotos.filter(f =>
      (filtroCiclo === 'todos' || f.ciclo === filtroCiclo) &&
      (filtroOperario === 'todos' || f.operario_id === filtroOperario) &&
      (filtroCategoria === 'todos' || f.categoria === filtroCategoria)
    );
  }, [fotos, filtroCiclo, filtroOperario, filtroCategoria]);

  // Agrupa por ciclo (desc) → operario (asc)
  const grupos = useMemo(() => {
    const map = new Map();
    filtradas.forEach(f => {
      const ciclo = f.ciclo;
      if (!map.has(ciclo)) map.set(ciclo, new Map());
      const opMap = map.get(ciclo);
      const opName = f.operario_name || 'Sin operario';
      if (!opMap.has(opName)) opMap.set(opName, []);
      opMap.get(opName).push(f);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtradas]);

  const totales = useMemo(() => {
    const importe = filtradas.reduce((s, f) => s + (Number(f.importe) || 0), 0);
    return { count: filtradas.length, importe };
  }, [filtradas]);

  return (
    <div className="pb-6">
      <PageHeader title="Fotos Contabilidad" subtitle="Facturas / tickets / albaranes organizados por ciclo mensual (26→25)" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <MobileSelect value={filtroCiclo} onValueChange={setFiltroCiclo} placeholder="Ciclo" triggerClassName="w-40 shrink-0">
            <MobileSelectItem value="todos">Todos los ciclos</MobileSelectItem>
            {ciclosDisponibles.map(c => <MobileSelectItem key={c} value={c}>{labelCiclo(c)}</MobileSelectItem>)}
          </MobileSelect>
          <MobileSelect value={filtroOperario} onValueChange={setFiltroOperario} placeholder="Operario" triggerClassName="w-44 shrink-0">
            <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
            {operariosPorFiltro.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
          <MobileSelect value={filtroCategoria} onValueChange={setFiltroCategoria} placeholder="Categoría" triggerClassName="w-36 shrink-0">
            <MobileSelectItem value="todos">Todas</MobileSelectItem>
            {CATEGORIAS.map(c => <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>)}
          </MobileSelect>

          <div className="flex items-center gap-3 ml-auto px-1">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {totales.count} foto{totales.count !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold text-sm">{totales.importe.toFixed(2)} €</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : grupos.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay fotos de tickets / facturas para los filtros seleccionados.</p>
            <p className="text-xs text-muted-foreground mt-1">Sube un registro desde <span className="font-semibold">Mis Gastos</span> con una foto del documento.</p>
          </div>
        ) : (
          grupos.map(([ciclo, opMap]) => {
            const fotosCiclo = Array.from(opMap.values()).reduce((s, arr) => s + arr.length, 0);
            const importeCiclo = Array.from(opMap.values()).flat().reduce((s, f) => s + (Number(f.importe) || 0), 0);
            return (
              <div key={ciclo} className="space-y-4">
                <div className="flex items-center gap-2 px-1 sticky top-0 bg-background/95 backdrop-blur z-10 py-1">
                  <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                  <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Ciclo {labelCiclo(ciclo)}</h2>
                  <span className="text-xs text-muted-foreground">· {fotosCiclo} foto{fotosCiclo !== 1 ? 's' : ''}</span>
                  <span className="text-xs font-semibold ml-auto">{importeCiclo.toFixed(2)} €</span>
                </div>

                {Array.from(opMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([opName, fotosOp]) => {
                  const opId = fotosOp[0]?.operario_id;
                  return (
                  <div key={opName} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <p className="text-xs font-semibold text-muted-foreground">{opName}</p>
                      <DescargarFotosCicloButton
                        cicloMes={ciclo}
                        operarioId={opId}
                        size="sm"
                        variant="outline"
                        label="Descargar fotos"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {fotosOp.map(f => <FotoGastoCard key={f.key} foto={f} />)}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
