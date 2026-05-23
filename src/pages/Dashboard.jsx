import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Building2, Users, Receipt, Car, Folder, Settings,
  HardHat, Sun, ClipboardList, Clock, Truck, Images,
  AlertCircle, CheckCircle2, BarChart2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useUserRole } from '@/lib/useUserRole';
import NotificacionesFichaje from '@/components/dashboard/NotificacionesFichaje';
import UserRoleDiagnostic from '@/components/debug/UserRoleDiagnostic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const HUB_CONFIG = [
  {
    id: 'obras',
    label: 'Obras & Proyectos',
    icon: Building2,
    path: '/obras',
    color: 'text-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    watermark: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60&fit=crop',
    module: 'obras',
    links: [
      { label: 'Obras civiles', path: '/obras', icon: Building2 },
      { label: 'Solar', path: '/solar-pedidos', icon: Sun },
      { label: 'Partes', path: '/work-orders', icon: ClipboardList },
      { label: 'Informe', path: '/informe-obras', icon: BarChart2 },
    ],
  },
  {
    id: 'personas',
    label: 'Personas & Equipos',
    icon: Users,
    path: '/operarios',
    color: 'text-teal-700',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    watermark: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60&fit=crop',
    module: 'operarios',
    links: [
      { label: 'Operarios', path: '/operarios', icon: Users },
      { label: 'Horario', path: '/control-horario', icon: Clock },
    ],
  },
  {
    id: 'economico',
    label: 'Económico',
    icon: Receipt,
    path: '/notas-gastos',
    color: 'text-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    watermark: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=60&fit=crop',
    module: 'notas-gastos',
    links: [
      { label: 'Gastos', path: '/notas-gastos', icon: Receipt },
    ],
  },
  {
    id: 'flota',
    label: 'Flota & Movilidad',
    icon: Car,
    path: '/flota',
    color: 'text-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    watermark: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&q=60&fit=crop',
    module: 'flota',
    links: [
      { label: 'Vehículos', path: '/flota', icon: Truck },
    ],
  },
  {
    id: 'documental',
    label: 'Documental',
    icon: Folder,
    path: '/drawings',
    color: 'text-orange-700',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    watermark: 'https://images.unsplash.com/photo-1568219656418-15c329312bf1?w=400&q=60&fit=crop',
    module: 'orders',
    links: [
      { label: 'Planos', path: '/drawings', icon: Folder },
      { label: 'Galería', path: '/galeria-fotos', icon: Images },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    path: '/users',
    color: 'text-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    border: 'border-slate-200 dark:border-slate-800',
    watermark: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=60&fit=crop',
    module: 'users',
    adminOnly: true,
    links: [
      { label: 'Usuarios', path: '/users', icon: Users },
    ],
  },
];

const roleLabels = {
  admin:           { label: 'Administrador',   color: 'bg-red-100 text-red-700 border-red-200' },
  jefe_obra:       { label: 'Jefe de Obra',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  operario:        { label: 'Operario',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  control_horario: { label: 'Control Horario', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cliente_obra:    { label: 'Cliente Obra',    color: 'bg-violet-100 text-violet-700 border-violet-200' },
  gerencia:        { label: 'Gerencia',        color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};

function HubCard({ hub, kpi }) {
  const Icon = hub.icon;
  return (
    <Link to={hub.path} className="block group">
      <div className={cn(
        'relative rounded-xl border overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-opacity-60',
        hub.bg, hub.border
      )}>
        {/* Watermark image */}
        {hub.watermark && (
          <img
            src={hub.watermark}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-[0.07] dark:opacity-[0.05] pointer-events-none select-none transition-opacity duration-300 group-hover:opacity-[0.12] dark:group-hover:opacity-[0.09]"
          />
        )}

        {/* Content */}
        <div className="relative z-10 p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className={cn('p-2 rounded-lg shadow-sm border', hub.bg, hub.border)}>
              <Icon className={cn('w-5 h-5', hub.color)} />
            </div>
            {kpi?.alert && (
              <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">
                <AlertCircle className="w-3 h-3 text-destructive" />
                <span className="text-[10px] font-bold text-destructive">{kpi.alert}</span>
              </div>
            )}
          </div>

          {/* Label & KPI */}
          <p className="text-xs font-bold text-foreground leading-tight mb-1">{hub.label}</p>
          {kpi?.main !== undefined && (
            <p className={cn('text-3xl font-extrabold leading-none tracking-tight', hub.color)}>{kpi.main}</p>
          )}
          {kpi?.sub && <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>}

          {/* Quick links */}
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-current/10">
            {hub.links.map(l => {
              const LIcon = l.icon;
              return (
                <span
                  key={l.path}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                    hub.bg, hub.border, hub.color
                  )}
                >
                  <LIcon className="w-2.5 h-2.5 shrink-0" />
                  {l.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { canAccess, isAdmin, role, isLoading: roleLoading } = useUserRole();
  const isGerencia = role === 'gerencia';

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
    queryFn: () => base44.entities.NotaGasto.list('-created_date', 100),
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

  const roleCfg = roleLabels[role] || roleLabels.operario;

  const visibleHubs = HUB_CONFIG.filter(hub => {
    if (hub.adminOnly && !isAdmin && !isGerencia) return false;
    return hub.module === null || canAccess(hub.module);
  });

  const showDiagnostic = !roleLoading && visibleHubs.length === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
        <Badge variant="outline" className={cn('text-xs font-semibold px-2.5 py-1', roleCfg.color)}>{roleCfg.label}</Badge>
      </div>

      {/* Alertas de fichaje */}
      <NotificacionesFichaje />

      {/* Hub grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {visibleHubs.map(hub => (
          <HubCard key={hub.id} hub={hub} kpi={kpis[hub.id]} />
        ))}
      </div>

      {showDiagnostic && <UserRoleDiagnostic />}
    </div>
  );
}