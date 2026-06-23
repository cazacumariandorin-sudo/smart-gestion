import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { toast } from 'sonner';
import { HardHat, RefreshCw, AlertCircle, MessageSquare, Images, ShieldCheck, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useUserRole } from '@/lib/useUserRole';
import NotificacionesFichaje from '@/components/dashboard/NotificacionesFichaje';
import UserRoleDiagnostic from '@/components/debug/UserRoleDiagnostic';
import { ModuloBadge, PanelTareas, useTareasAdmin } from '@/components/dashboard/TareasIndicador';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { HUBS, isHubVisible } from '@/lib/hubs';
import HubSheet from '@/components/dashboard/HubSheet';

const QUICK_ACCESS = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    color: 'text-emerald-800',
    iconBg: 'bg-emerald-600',
    bg: 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/50 dark:to-emerald-950/40',
    border: 'border-emerald-300 dark:border-emerald-700',
    watermark: null,
    module: 'chat',
    items: [{ label: 'Chat', path: '/chat', icon: MessageSquare }],
  },
  {
    id: 'galeria',
    label: 'Foto Obra',
    icon: Images,
    color: 'text-violet-800',
    iconBg: 'bg-violet-600',
    bg: 'bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/50 dark:to-violet-950/40',
    border: 'border-violet-300 dark:border-violet-700',
    watermark: null,
    module: 'galeria-fotos',
    items: [{ label: 'Galería', path: '/galeria-fotos', icon: Images }],
  },
];

const DASHBOARD_META = {
  obras: { watermark: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/50 dark:to-purple-950/40', border: 'border-purple-300 dark:border-purple-700', iconBg: 'bg-purple-600', color: 'text-purple-800' },
  personas: { watermark: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/50 dark:to-teal-950/40', border: 'border-teal-300 dark:border-teal-700', iconBg: 'bg-teal-600', color: 'text-teal-800' },
  economico: { watermark: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-950/40', border: 'border-amber-300 dark:border-amber-700', iconBg: 'bg-amber-500', color: 'text-amber-800' },
  flota: { watermark: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-950/40', border: 'border-blue-300 dark:border-blue-700', iconBg: 'bg-blue-600', color: 'text-blue-800' },
  documental: { watermark: 'https://images.unsplash.com/photo-1568219656418-15c329312bf1?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/50 dark:to-orange-950/40', border: 'border-orange-300 dark:border-orange-700', iconBg: 'bg-orange-500', color: 'text-orange-800' },
  sistema: { watermark: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=60&fit=crop', bg: 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900/50 dark:to-slate-950/40', border: 'border-slate-300 dark:border-slate-700', iconBg: 'bg-slate-600', color: 'text-slate-800' },
};

import { ROLE_LABELS } from '@/lib/roleLabels';
import TareasButton from '@/components/dashboard/TareasButton';

function ModuleCard({ hub, kpi, tareas = [], onTareasClick, onOpen }) {
  const Icon = hub.icon;

  return (
    <button
      onClick={onOpen}
      style={{ touchAction: 'manipulation' }}
      className={cn(
        'relative rounded-xl border overflow-hidden transition-all duration-150 text-left w-full',
        'active:scale-[0.97] hover:brightness-95',
        hub.bg, hub.border
      )}
    >
      {onTareasClick && <ModuloBadge moduloId={hub.id} tareas={tareas} onClick={(e) => { e.stopPropagation(); onTareasClick(tareas.filter(t => t.modulo === hub.id)); }} />}
      {hub.watermark && (
        <img src={hub.watermark} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none select-none" />
      )}
      <div className="relative z-10 px-4 pt-3 pb-3 space-y-1.5">
        {/* Cabecera: icono + label + KPI */}
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-lg shadow-sm shrink-0', hub.iconBg)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={cn('text-xs font-extrabold uppercase tracking-wide leading-tight', hub.color)}>{hub.label}</p>
              {kpi?.alert > 0 && (
                <span className="inline-flex items-center gap-0.5 bg-destructive/10 border border-destructive/30 rounded-full px-1.5 py-0.5">
                  <AlertCircle className="w-2.5 h-2.5 text-destructive" />
                  <span className="text-[9px] font-bold text-destructive">{kpi.alert}</span>
                </span>
              )}
            </div>
            {kpi?.sub && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{kpi.sub}</p>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        </div>

        {/* Sub-módulos preview */}
        <div className="flex flex-wrap gap-1">
          {hub.items.slice(0, 3).map(l => (
            <span key={l.path} className="text-[9px] font-medium text-muted-foreground bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5">
              {l.label}
            </span>
          ))}
          {hub.items.length > 3 && (
            <span className="text-[9px] font-medium text-muted-foreground bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5">
              +{hub.items.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { canAccess, isAdmin, role, isLoading: roleLoading } = useUserRole();
  const isGerencia = role === 'gerencia';
  const isDirComercial = role === 'director_comercial';
  const isTrioAdmin = isAdmin || isGerencia || isDirComercial;

  const { data: tareasAdmin = [] } = useTareasAdmin(isTrioAdmin);
  const [panelTareas, setPanelTareas] = useState(null); // array de tareas a mostrar

  const onRefresh = () => {
    ['obras_dash', 'operarios_dash', 'gastos_dash', 'fichajes_hoy', 'flota_dash'].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const [activeHub, setActiveHub] = useState(null);

  const [auditando, setAuditando] = useState(false);

  const handleAuditoriaIdentidad = async () => {
    try {
      setAuditando(true);
      const res = await base44.functions.invoke('sincronizarTodoElSistema', {});
      if (res.data.success) {
        const r = res.data.resumen;
        toast.success('Auditoría completada', {
          description: `${r.registros_actualizados} registros actualizados · ${r.alertas_obra_huerfana} alertas de obra`
        });
      }
    } catch (error) {
      toast.error('Error en auditoría', { description: error.message });
    } finally {
      setAuditando(false);
    }
  };

  const [auditandoObras, setAuditandoObras] = useState(false);

  const handleAuditoriaObras = async () => {
    try {
      setAuditandoObras(true);
      const res = await base44.functions.invoke('sincronizarObrasEnCaliente', {});
      if (res.data.success) {
        const r = res.data.resumen;
        toast.success('Auditoría de Obras completada', {
          description: `${r.obras_procesadas} obras · ${r.ids_generados} IDs generados · ${r.duplicados_detectados} duplicados detectados`
        });
      }
    } catch (error) {
      toast.error('Error en auditoría de obras', { description: error.message });
    } finally {
      setAuditandoObras(false);
    }
  };

  const { data: obras = [] } = useQuery({
    queryKey: ['obras_dash'],
    queryFn: () => base44.entities.Obra.list('name', 200),
    enabled: canAccess('obras'),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios_dash'],
    queryFn: () => base44.entities.Operario.list('name', 200),
    enabled: canAccess('operarios'),
  });
  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos_dash'],
    queryFn: () => base44.entities.RegistroGasto.list('-created_date', 100),
    enabled: canAccess('notas-gastos'),
  });
  const { data: fichajesHoy = [] } = useQuery({
    queryKey: ['fichajes_hoy'],
    queryFn: () => base44.entities.Fichaje.filter({ date: format(new Date(), 'yyyy-MM-dd') }),
    enabled: canAccess('control-horario'),
  });
  const { data: vehiculos = [] } = useQuery({
    queryKey: ['flota_dash'],
    queryFn: () => base44.entities.Vehiculo.list('matricula', 100),
    enabled: canAccess('flota'),
  });

  const kpis = {
    obras: {
      main: obras.filter(o => o.status === 'activa').length,
      sub: `${obras.length} total · ${obras.filter(o => o.status === 'activa').length} activas`,
    },
    personas: {
      main: operarios.filter(o => o.active !== false).length,
      sub: `${fichajesHoy.length} fichajes hoy`,
    },
    economico: {
      main: gastos.filter(g => g.estado === 'pendiente').length,
      sub: 'gastos pendientes',
      alert: gastos.filter(g => g.estado === 'pendiente').length > 0 ? gastos.filter(g => g.estado === 'pendiente').length : undefined,
    },
    flota: {
      main: vehiculos.length,
      sub: 'vehículos',
    },
    documental: {
      main: undefined,
      sub: 'Planos, manuales, fotos',
    },
    sistema: {
      main: undefined,
      sub: 'Gestión del sistema',
    },
  };

  const roleCfg = ROLE_LABELS[role] || { label: role, className: 'bg-gray-100 text-gray-700 border-gray-200' };

  const visibleHubs = HUBS
    .filter(hub => isHubVisible(hub, { role, isDemo: role === 'usuario_demo' }))
    .filter(hub => hub.module === null || canAccess(hub.module))
    .map(hub => ({ ...hub, ...DASHBOARD_META[hub.id] }));

  const showDiagnostic = !roleLoading && visibleHubs.length === 0;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <HardHat className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">Panel General</h1>
          </div>
          <p className="text-xs text-muted-foreground capitalize pl-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isTrioAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAuditoriaIdentidad}
                disabled={auditando}
                className="gap-2 h-9 px-3 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400"
                title="Ejecutar Auditoría de Identidad (Regla de Oro)"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${auditando ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{auditando ? 'Auditando...' : 'Auditoría'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAuditoriaObras}
                disabled={auditandoObras}
                className="gap-2 h-9 px-3 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-400"
                title="Ejecutar Auditoría de Obras (IDs y Duplicados)"
              >
                <HardHat className={`w-3.5 h-3.5 ${auditandoObras ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{auditandoObras ? 'Auditando...' : 'Obras'}</span>
              </Button>
              <TareasButton onClick={() => setPanelTareas(tareasAdmin)} />
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            className="gap-2 h-9 px-4"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Badge variant="outline" className={cn('text-xs font-semibold px-2.5 py-1', roleCfg.className)}>{roleCfg.label}</Badge>
        </div>
      </div>

      {/* Alertas de fichaje */}
      <NotificacionesFichaje />

      {/* Grid unificado: módulos + accesos rápidos */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {visibleHubs.map(hub => (
          <ModuleCard key={hub.id} hub={hub} kpi={kpis[hub.id]}
            tareas={isTrioAdmin ? tareasAdmin : []}
            onTareasClick={isTrioAdmin ? setPanelTareas : undefined}
            onOpen={() => setActiveHub(hub)}
          />
        ))}
        {QUICK_ACCESS.map(hub => (
          <ModuleCard key={hub.id} hub={hub} kpi={undefined} onOpen={() => setActiveHub(hub)} />
        ))}
      </div>

      <HubSheet
        hub={activeHub}
        open={!!activeHub}
        onOpenChange={(open) => { if (!open) setActiveHub(null); }}
      />

      {showDiagnostic && <UserRoleDiagnostic />}

      {panelTareas && (
        <PanelTareas
          tareasSeleccionadas={panelTareas}
          onClose={() => setPanelTareas(null)}
        />
      )}
    </div>
  );
}