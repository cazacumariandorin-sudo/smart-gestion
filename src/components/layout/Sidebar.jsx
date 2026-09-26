import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CircleUser, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useUserRole } from '@/lib/useUserRole';
import { getQueueCountByHub } from '@/utils/offlineQueue';
import { HUBS, isHubVisible } from '@/lib/hubs';



function HubGroup({ hub, currentPath, currentFullPath, canAccess, isAdmin, isGerencia, isDemo, role, pendingCount = 0 }) {
  const items = hub.items.filter(i => i.module === null || canAccess(i.module));
  // Los items cuyo `path` lleva query string (p. ej. '/notas-gastos?vista=admin')
  // deben compararse contra la ruta completa (pathname + search), no solo el
  // pathname — si no, un item hermano con el mismo pathname pero sin query
  // (p. ej. 'Mis Gastos' -> '/notas-gastos') siempre "gana" el resaltado activo,
  // porque el pathname coincide igual esté o no el query presente.
  const matchItem = (i) => {
    if (i.path.includes('?')) return currentFullPath === i.path;
    return currentPath === i.path || (i.path !== '/' && currentPath.startsWith(i.path));
  };
  const isChildActive = items.some(matchItem);
  const [open, setOpen] = useState(isChildActive);

  if (items.length === 0) return null;
  if (!isHubVisible(hub, { role, isDemo })) return null;

  const Icon = hub.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold transition-all',
          isChildActive
            ? cn(hub.activeBg, hub.color)
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <Icon className={cn('w-4 h-4 shrink-0', isChildActive ? hub.color : '')} />
        <span className="flex-1 text-left text-xs overflow-hidden whitespace-nowrap opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">{hub.label}</span>
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold bg-orange-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">
            {pendingCount}
          </span>
        )}
        <span className="text-[10px] font-normal bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center shrink-0 opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">
          {items.length}
        </span>
        {open
          ? <ChevronDown className="w-3 h-3 shrink-0 opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150" />
          : <ChevronRight className="w-3 h-3 shrink-0 opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150" />}
      </button>

      {open && (
        <div className={cn('ml-3 mt-0.5 mb-1 space-y-0.5 border-l-2 pl-3 opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150', hub.borderColor)}>
          {items.map(item => {
            const isActive = matchItem(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-all',
                  isActive
                    ? cn(hub.activeBg, hub.color, 'font-semibold')
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { canAccess, isAdmin, isDemo, role } = useUserRole();
  const path = location.pathname;
  const fullPath = path + (location.search || '');
  const isGerencia = role === 'gerencia';
  const isDashboard = path === '/';

  const [queueCounts, setQueueCounts] = useState({ obras: 0, personas: 0, economico: 0 });

  useEffect(() => {
    const update = () => setQueueCounts(getQueueCountByHub());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // Poll cada 10s para reflejar cambios
    const interval = setInterval(update, 10000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="hidden md:flex flex-col border-r border-border bg-card h-screen sticky top-0 shrink-0
      w-14 lg:w-60 overflow-hidden
      transition-all duration-200 ease-in-out
      hover:w-60 hover:shadow-[2px_0_12px_rgba(0,0,0,0.08)]
      group/sidebar">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="https://media.base44.com/images/public/69de8e23b1cd7ac050397c82/7bb9498dd_logoSimantecnew.png" 
            alt="SIMANTEC" 
            className="w-8 h-8 shrink-0 object-contain"
          />
          <div className="overflow-hidden whitespace-nowrap opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">
            <h1 className="text-sm font-extrabold uppercase tracking-tight text-emerald-600">SIMANTEC</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Gestión Empresarial</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {/* Dashboard */}
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all mb-1.5',
            isDashboard ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="overflow-hidden whitespace-nowrap opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">Panel General</span>
        </Link>

        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1 overflow-hidden whitespace-nowrap opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">Módulos</p>

        {HUBS.map(hub => (
          <HubGroup
            key={hub.id}
            hub={hub}
            currentPath={path}
            currentFullPath={fullPath}
            canAccess={canAccess}
            isAdmin={isAdmin}
            isGerencia={isGerencia}
            isDemo={isDemo}
            role={role}
            pendingCount={
              hub.id === 'obras' ? queueCounts.obras :
              hub.id === 'personas' ? queueCounts.personas :
              hub.id === 'economico' ? queueCounts.economico : 0
            }
          />
        ))}
      </nav>

      {/* Language selector */}
      <div className="px-2 pb-2 overflow-hidden opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">
        <div className="flex gap-1">
          {[['es', '🇪🇸'], ['en', '🇬🇧'], ['fr', '🇫🇷']].map(([code, flag]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={cn(
                'flex-1 text-xs py-1 rounded-md font-medium transition-colors',
                lang === code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="px-2 pb-4 border-t border-border pt-3 shrink-0">
        <Link
          to="/profile"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all',
            path === '/profile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <CircleUser className="w-4 h-4 shrink-0" />
          <span className="overflow-hidden whitespace-nowrap opacity-0 lg:opacity-100 group-hover/sidebar:opacity-100 transition-opacity duration-150">{t('nav_profile')}</span>
        </Link>
      </div>
    </aside>
  );
}