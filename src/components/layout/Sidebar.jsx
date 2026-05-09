import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Plus, HardHat, Users, BarChart3, Camera,
  UserCog, CircleUser, Package, FileImage, ShoppingCart, Clock, Receipt, Car,
  Building2, BookOpen, CalendarDays, ChevronDown, ChevronRight, Sun, Factory, Settings, FlaskConical, BarChart2 } from
'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useUserRole } from '@/lib/useUserRole';

function NavItem({ item, isActive }) {
  return (
    <Link
      to={item.path}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}>
      
      <item.icon className="w-4 h-4 shrink-0" />
      {item.label}
    </Link>);

}

function NavGroup({ icon: GroupIcon, label, children, defaultOpen = false, currentPath }) {
  const isChildActive = children.some((c) => currentPath === c.path || c.path !== '/' && currentPath.startsWith(c.path));
  const [open, setOpen] = useState(defaultOpen || isChildActive);

  if (children.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
          isChildActive ? 'text-primary bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}>
        
        <GroupIcon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open &&
      <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
          {children.map((item) => {
          const isActive = currentPath === item.path || item.path !== '/' && currentPath.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all',
                isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}>
              
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>);

        })}
        </div>
      }
    </div>);

}

export default function Sidebar() {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { canAccess } = useUserRole();
  const path = location.pathname;

  // Top-level items with their required module key
  const topItems = [
  { label: t('nav_dashboard'), path: '/', icon: LayoutDashboard, module: null },
  { label: 'Informe Operarios', path: '/informe-obras', icon: BarChart2, module: 'informe-obras' },
  { label: t('nav_workorders'), path: '/work-orders', icon: ClipboardList, module: 'work-orders' },
  { label: t('nav_new_order'), path: '/work-orders/new', icon: Plus, module: 'work-orders' },
  { label: t('nav_photos'), path: '/photos', icon: Camera, module: 'photos' },
  { label: t('nav_clients'), path: '/clients', icon: UserCog, module: 'clients' }].
  filter((i) => i.module === null || canAccess(i.module));

  // Equipos group — each item has a module guard
  const operariosItems = [
  { label: 'Operarios', path: '/operarios', icon: Users, module: 'operarios' },
  { label: 'Documentación', path: '/documentacion-operarios', icon: FileImage, module: 'operarios' },
  { label: 'Notas de Gastos', path: '/notas-gastos', icon: Receipt, module: 'notas-gastos' },
  { label: 'Vacaciones', path: '/calendario-vacaciones', icon: CalendarDays, module: 'calendario-vacaciones' },
  { label: 'Control Horario', path: '/control-horario', icon: Clock, module: 'control-horario' }].
  filter((i) => canAccess(i.module));

  // Gestión group
  const pedidosItems = [
  { label: 'Obras', path: '/obras', icon: Building2, module: 'obras' },
  { label: 'Planos', path: '/drawings', icon: FileImage, module: 'orders' },
  { label: 'Manuales', path: '/manuales', icon: BookOpen, module: 'orders' },
  { label: 'Fabricantes', path: '/fabricantes', icon: Factory, module: 'users' },
  { label: 'Pedidos', path: '/orders', icon: ShoppingCart, module: 'orders' },
  { label: 'Materiales', path: '/materials', icon: Package, module: 'orders' }].
  filter((i) => canAccess(i.module));

  const solarItems = [
  { label: 'Pedidos Solar', path: '/solar-pedidos', icon: ShoppingCart, module: 'orders' },
  { label: 'Obras Solar', path: '/solar-obras', icon: Building2, module: 'obras' }].
  filter((i) => canAccess(i.module));

  const adminItems = [
  { label: 'Usuarios', path: '/users', icon: Users, module: 'users' },
  { label: 'Usuarios Demo', path: '/demo-users', icon: FlaskConical, module: 'users' },
  { label: 'Datos Sensibles', path: '/datos-sensibles', icon: Settings, module: 'users' },
  { label: 'Inventario', path: '/inventario', icon: Package, module: 'users' },
  { label: 'Vehículos', path: '/vehiculos', icon: Car, module: 'vehiculos' },
  { label: 'Informe Mensual', path: '/reports', icon: BarChart3, module: 'reports' }].
  filter((i) => canAccess(i.module));

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="tracking-tight leading-tight text-lg font-extrabold text-justify uppercase bg-[hsl(var(--background))] text-emerald-600 px-3">SIMANTEC</h1>
            <p className="text-xs text-muted-foreground leading-tight">Gestión Empresarial</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {topItems.map((item) => {
          const isActive = path === item.path || item.path !== '/' && path.startsWith(item.path);
          return <NavItem key={item.path} item={item} isActive={isActive} />;
        })}

        {operariosItems.length > 0 &&
        <div className="pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Equipos</p>
            <NavGroup icon={Users} label="Operarios" currentPath={path} defaultOpen={operariosItems.some((i) => path.startsWith(i.path))}>
              {operariosItems}
            </NavGroup>
          </div>
        }

        {pedidosItems.length > 0 &&
        <div className="pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Gestión</p>
            <NavGroup icon={ShoppingCart} label="Pedidos y Obras" currentPath={path} defaultOpen={pedidosItems.some((i) => path.startsWith(i.path))}>
              {pedidosItems}
            </NavGroup>
          </div>
        }

        {solarItems.length > 0 &&
        <div className="pt-2">
            <NavGroup icon={Sun} label="Solar" currentPath={path} defaultOpen={solarItems.some((i) => path.startsWith(i.path))}>
              {solarItems}
            </NavGroup>
          </div>
        }

        {adminItems.length > 0 &&
        <div className="pt-2">
            <NavGroup icon={Settings} label="Administración" currentPath={path} defaultOpen={adminItems.some((i) => path.startsWith(i.path))}>
              {adminItems}
            </NavGroup>
          </div>
        }
      </nav>

      {/* Language selector */}
      <div className="px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Idioma</p>
        <div className="flex gap-1">
          {[['es', '🇪🇸 ES'], ['en', '🇬🇧 EN'], ['fr', '🇫🇷 FR']].map(([code, label]) =>
          <button
            key={code}
            onClick={() => setLang(code)}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors',
              lang === code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}>
            
              {label}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Link
          to="/profile"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            path === '/profile' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}>
          
          <CircleUser className="w-4 h-4" />
          {t('nav_profile')}
        </Link>
      </div>
    </aside>);

}