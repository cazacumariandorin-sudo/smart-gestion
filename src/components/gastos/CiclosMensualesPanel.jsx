import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';
import CicloCard from '@/components/gastos/CicloCard';
import BannerCicloActivo from '@/components/gastos/BannerCicloActivo';
import ConsolidarCicloButton from '@/components/gastos/ConsolidarCicloButton';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Filter } from 'lucide-react';

const ESTADOS = ['todos', 'borrador', 'enviada', 'aprobada', 'en_contabilidad', 'pagada', 'rechazada'];
const ESTADO_LABELS = {
  todos: 'Todos los estados',
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  en_contabilidad: 'En contabilidad',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

/**
 * Panel de ciclos mensuales de gastos (NotaMensualGasto).
 *
 * - Lista ciclos por operario/mes con estado, total y nº de registros.
 * - Filtros por mes / operario / estado.
 * - Botón "Consolidar ciclo" (gerencia/admin/administracion/director_comercial)
 *   para invocar cerrarCicloGastosMensual bajo demanda y desbloquear el histórico.
 */
export default function CiclosMensualesPanel() {
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion, isDirComercial } = useUserRole();
  const qc = useQueryClient();
  const canExport = isAdmin || isGerencia;
  const canConsolidar = isAdmin || isGerencia || isAdministracion || isDirComercial;

  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroOperario, setFiltroOperario] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['nota_mensual_gasto'],
    queryFn: () => base44.entities.NotaMensualGasto.list('-ciclo_mes', 500),
  });

  // Opciones para los filtros (derivadas de los datos cargados)
  const mesesOptions = useMemo(() => {
    const set = new Set();
    ciclos.forEach(c => { if (c.ciclo_mes) set.add(c.ciclo_mes); });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [ciclos]);

  const operariosOptions = useMemo(() => {
    const map = {};
    ciclos.forEach(c => {
      if (c.operario_id && !map[c.operario_id]) {
        map[c.operario_id] = c.operario_name || c.operario_id;
      }
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [ciclos]);

  // Filtrado
  const ciclosFiltrados = useMemo(() => {
    return ciclos.filter(c => {
      const matchMes = filtroMes === 'todos' || c.ciclo_mes === filtroMes;
      const matchOp = filtroOperario === 'todos' || c.operario_id === filtroOperario;
      const matchEst = filtroEstado === 'todos' || c.estado === filtroEstado;
      return matchMes && matchOp && matchEst;
    });
  }, [ciclos, filtroMes, filtroOperario, filtroEstado]);

  // Agrupar por ciclo_mes (descendente)
  const grupos = {};
  for (const c of ciclosFiltrados) {
    const key = c.ciclo_mes || 'sin_ciclo';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }
  const cicloKeys = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  const onExported = () => {
    qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
  };

  const hayFiltrosActivos = filtroMes !== 'todos' || filtroOperario !== 'todos' || filtroEstado !== 'todos';

  return (
    <div className="space-y-4">
      <BannerCicloActivo />

      {canConsolidar && (
        <div className="flex items-center justify-end">
          <ConsolidarCicloButton ciclosDisponibles={mesesOptions} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filtrar</span>
        </div>
        <MobileSelect value={filtroMes} onValueChange={setFiltroMes} triggerClassName="w-36">
          <MobileSelectItem value="todos">Todos los meses</MobileSelectItem>
          {mesesOptions.map(m => <MobileSelectItem key={m} value={m}>{m}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={filtroOperario} onValueChange={setFiltroOperario} triggerClassName="w-44">
          <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
          {operariosOptions.map(op => (
            <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
          ))}
        </MobileSelect>
        <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado} triggerClassName="w-44">
          {ESTADOS.map(e => <MobileSelectItem key={e} value={e}>{ESTADO_LABELS[e] || e}</MobileSelectItem>)}
        </MobileSelect>
        {hayFiltrosActivos && (
          <button
            onClick={() => { setFiltroMes('todos'); setFiltroOperario('todos'); setFiltroEstado('todos'); }}
            className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando ciclos…
        </div>
      ) : cicloKeys.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl text-sm text-muted-foreground">
          {hayFiltrosActivos
            ? 'No hay ciclos que cumplan estos filtros.'
            : 'Todavía no hay ciclos mensuales de gastos abiertos.'}
        </div>
      ) : (
        <div className="space-y-5">
          {cicloKeys.map(key => (
            <div key={key}>
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-2 mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Ciclo <span className="font-mono">{key}</span>
                </h3>
                <span className="text-xs text-muted-foreground">
                  {grupos[key].length} nota{grupos[key].length === 1 ? '' : 's'}
                  {' · '}
                  {grupos[key].reduce((s, n) => s + (n.total_importe || 0), 0).toFixed(2)} €
                </span>
              </div>
              <div className="space-y-2">
                {grupos[key].map(nota => (
                  <CicloCard key={nota.id} nota={nota} canExport={canExport} onExported={onExported} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}