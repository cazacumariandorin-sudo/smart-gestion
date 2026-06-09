import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  Building2, Users, Receipt, Car, Folder, Settings,
  HardHat, Sun, ClipboardList, Clock, Truck, Images,
  AlertCircle, BarChart2, MessageSquare, Database,
  Link2, FlaskConical, RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useUserRole } from '@/lib/useUserRole';
import NotificacionesFichaje from '@/components/dashboard/NotificacionesFichaje';
import UserRoleDiagnostic from '@/components/debug/UserRoleDiagnostic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const HUB_CONFIG = [
  {
    id: 'obras',
    label: 'Obras & Proyectos',
    icon: Building2,
    path: '/obras-civiles',
    color: 'text-purple-800',
    iconBg: 'bg-purple-600',
    bg: 'bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/50 dark:to-purple-950/40',
    border: 'border-purple-300 dark:border-purple-700',
    watermark: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60&fit=crop',
    module: 'obras-civiles',
    links: [
      { label: 'Obras civiles', path: '/obras-civiles', icon: Building2 },
      { label: 'Solar', path: '/solar', icon: Sun },
      { label: 'Partes', path: '/work-orders', icon: ClipboardList },
      { label: 'Informe', path: '/informe-obras', icon: BarChart2 },
    ],
  },
  {
    id: 'personas',
    label: 'Personas & Equipos',
    icon: Users,
    path: '/operarios',
    color: 'text-teal-800',
    iconBg: 'bg-teal-600',
    bg: 'bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/50 dark:to-teal-950/40',
    border: 'border-teal-300 dark:border-teal-700',
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
    color: 'text-amber-800',
    iconBg: 'bg-amber-500',
    bg: 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-950/40',
    border: 'border-amber-300 dark:border-amber-700',
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
    color: 'text-blue-800',
    iconBg: 'bg-blue-600',
    bg: 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-950/40',
    border: 'border-blue-300 dark:border-blue-700',
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
    color: 'text-orange-800',
    iconBg: 'bg-orange-500',
    bg: 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/50 dark:to-orange-950/40',
    border: 'border-orange-300 dark:border-orange-700',
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
    color: 'text-slate-800',
    iconBg: 'bg-slate-600',
    bg: 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900/50 dark:to-slate-950/40',
    border: 'border-slate-300 dark:border-slate-700',
    watermark: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=60&fit=crop',
    module: 'users',
    adminOrGerencia: true,
    links: [
      { label: 'Usuarios',      path: '/users',              icon: Users },
      { label: 'Chat',          path: '/chat',               icon: MessageSquare },
      { label: 'Demos',         path: '/demo-users',         icon: FlaskConical },
      { label: 'Invitaciones',  path: '/invitaciones-demo',  icon: Link2 },
      { label: 'Backup',        path: '/admin-backup',       icon: Database },
      { label: 'Informes',      path: '/reports',            icon: BarChart2 },
      { label: 'Vinculaciones', path: '/vinculacion',        icon: Users },
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

function ModuleCard({ hub, kpi }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const Icon = hub.icon;
  const isSingle = hub.links.length === 1;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const handleBtn = () => {
    if (isSingle) {
      navigate(hub.links[0].path);
    } else {
      setOpen(o => !o);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className={cn(
        'relative rounded-xl border overflow-hidden transition-all duration-200',
        hub.bg, hub.border
      )}>
        {hub.watermark && (
          <img src={hub.watermark} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none select-none" />
        )}
        <div className="relative z-10 flex items-center gap-3 px-4 py-3">
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
            {kpi?.sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{kpi.sub}</p>}
          </div>
          <button
            onClick={handleBtn}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-lg min-w-[90px] justify-center',
              'text-xs font-bold border transition-all duration-150',
              'bg-slate-800 dark:bg-slate-700 text-white border-slate-700',
              'hover:bg-slate-700 active:scale-95'
            )}
          >
            {isSingle ? 'Abrir' : (
              <>
                Gestionar
                <span className={cn('transition-transform duration-200', open ? 'rotate-180' : 'rotate-0')}>▾</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!isSingle && open && (
        <div className={cn(
          'absolute top-full left-0 right-0 z-50 mt-1',
          'bg-card border border-border rounded-xl shadow-xl',
          'p-2 grid grid-cols-3 gap-1.5'
        )}>
          {hub.links.map(l => {
            const LIcon = l.icon;
            return (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 px-2',
                  'rounded-lg bg-muted/60 hover:bg-muted',
                  'text-[10px] font-semibold text-muted-foreground',
                  'hover:text-foreground transition-all active:scale-95',
                  'min-h-[56px] justify-center'
                )}
              >
                <LIcon className="w-4 h-4 shrink-0" />
                <span className="text-center leading-tight">{l.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
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

  const roleCfg = roleLabels[role] || roleLabels.operario;

  const visibleHubs = HUB_CONFIG.filter(hub => {
    if (hub.adminOnly && !isAdmin && !isGerencia) return false;
    if (hub.adminOrGerencia && !isAdmin && !isGerencia) return false;
    return hub.module === null || canAccess(hub.module);
  });

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
          <Badge variant="outline" className={cn('text-xs font-semibold px-2.5 py-1', roleCfg.color)}>{roleCfg.label}</Badge>
        </div>
      </div>

      {/* Alertas de fichaje */}
      <NotificacionesFichaje />

      {/* Grid unificado: módulos + accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {visibleHubs.map(hub => (
          <ModuleCard key={hub.id} hub={hub} kpi={kpis[hub.id]} />
        ))}
        {QUICK_ACCESS.map(hub => (
          <ModuleCard key={hub.id} hub={hub} kpi={undefined} />
        ))}
      </div>

      {showDiagnostic && <UserRoleDiagnostic />}
    </div>
  );
}