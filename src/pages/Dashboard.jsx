import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { HardHat, RefreshCw, ChevronDown, ChevronUp, AlertCircle, MessageSquare, Images } from 'lucide-react';
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
    links: [{ label: 'Chat', path: '/chat', icon: MessageSquare }],
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
    links: [{ label: 'Galería', path: '/galeria-fotos', icon: Images }],
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

const MAX_VISIBLE_LINKS = 3;

function ModuleCard({ hub, kpi, tareas = [], onTareasClick }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = hub.icon;

  const visibleLinks = hub.items.slice(0, MAX_VISIBLE_LINKS);
  const hiddenLinks = hub.items.slice(MAX_VISIBLE_LINKS);
  const hasMore = hiddenLinks.length > 0;

  return (
    <div className={cn(
      'relative rounded-xl border overflow-hidden transition-all duration-200',
      hub.bg, hub.border
    )}>
      {onTareasClick && <ModuloBadge moduloId={hub.id} tareas={tareas} onClick={onTareasClick} />}
      {hub.watermark && (
        <img src={hub.watermark} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none select-none" />
      )}
      <div className="relative z-10 px-4 pt-3 pb-3 space-y-2.5">

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
        </div>

        {/* Pill-buttons: links visibles + botón expandir */}
        <div className="flex flex-wrap gap-1.5">
          {visibleLinks.map(l => {
            const LIcon = l.icon;
            return (
              <Link
                key={l.path}
                to={l.path}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'inline-flex items-center gap-1 h-6 px-2.5 rounded-full',
                  'text-[10px] font-semibold border transition-all duration-150',
                  'bg-foreground/10 dark:bg-white/15',
                  'border-foreground/20 dark:border-white/20',
                  'text-foreground hover:bg-foreground/20',
                  'active:scale-95'
                )}
              >
                <LIcon className="w-3 h-3 shrink-0" />
                {l.label}
              </Link>
            );
          })}

          {hasMore && (
            <button
              onClick={() => setExpanded(o => !o)}
              style={{ touchAction: 'manipulation' }}
              aria-label={expanded ? 'Ver menos' : `Ver ${hiddenLinks.length} más`}
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2 rounded-full',
                'text-[10px] font-semibold border transition-all duration-150',
                'bg-foreground/10 dark:bg-white/15',
                'border-foreground/20 dark:border-white/20',
                'text-foreground hover:bg-foreground/15',
                'active:scale-95'
              )}
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" />Menos</>
                : <><ChevronDown className="w-3 h-3" />+{hiddenLinks.length}</>
              }
            </button>
          )}
        </div>

        {/* Links ocultos expandidos en grid 3 col dentro de la tarjeta */}
        {hasMore && expanded && (
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-foreground/10">
            {hiddenLinks.map(l => {
              const LIcon = l.icon;
              return (
                <Link
                  key={l.path}
                  to={l.path}
                  onClick={() => setExpanded(false)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 px-1 rounded-lg',
                    'bg-black/5 dark:bg-white/5',
                    'hover:bg-black/10 dark:hover:bg-white/10',
                    'text-[9px] font-semibold text-muted-foreground hover:text-foreground',
                    'transition-all active:scale-95 min-h-[44px] justify-center'
                  )}
                >
                  <LIcon className="w-3.5 h-3.5 shrink-0" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
            <TareasButton onClick={() => setPanelTareas(tareasAdmin)} />
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
          />
        ))}
        {QUICK_ACCESS.map(hub => (
          <ModuleCard key={hub.id} hub={hub} kpi={undefined} />
        ))}
      </div>

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