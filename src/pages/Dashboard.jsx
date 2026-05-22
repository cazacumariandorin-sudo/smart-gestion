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
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
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
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
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
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
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
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
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
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
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
    color: 'text-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    border: 'border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
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
      <div className={cn('rounded-xl border p-4 transition-all hover:shadow-sm hover:-translate-y-0.5', hub.bg, hub.border)}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2 rounded-lg', hub.bg)}>
            <Icon className={cn('w-5 h-5', hub.color)} />
          </div>
          {kpi?.alert && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs font-semibold text-destructive">{kpi.alert}</span>
            </div>
          )}
        </div>

        {/* Label & KPI */}
        <p className="text-xs font-bold text-foreground leading-tight mb-1">{hub.label}</p>
        {kpi?.main !== undefined && (
          <p className={cn('text-2xl font-bold leading-none', hub.color)}>{kpi.main}</p>
        )}
        {kpi?.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>}

        {/* Quick links */}
        <div className="flex flex-wrap gap-1 mt-3">
          {hub.links.map(l => {
            const LIcon = l.icon;
            return (
              <span
                key={l.path}
                className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', hub.bg, hub.border, hub.color)}
              >
                <LIcon className="w-2.5 h-2.5 shrink-0" />
                {l.label}
              </span>
            );
          })}
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <HardHat className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Panel General</h1>
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Badge variant="outline" className={cn('text-xs font-semibold', roleCfg.color)}>{roleCfg.label}</Badge>
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