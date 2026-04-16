import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Plus, HardHat, Users, BarChart3, Camera, UserCog, CircleUser, Package, FileImage, ShoppingCart, Receipt, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export default function Sidebar() {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();

  const navItems = [
    { label: t('nav_dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('nav_clients'), path: '/clients', icon: Users },
    { label: t('nav_workorders'), path: '/work-orders', icon: ClipboardList },
    { label: t('nav_new_order'), path: '/work-orders/new', icon: Plus },
    { label: t('nav_materials'), path: '/materials', icon: Package },
    { label: t('nav_orders'), path: '/orders', icon: ShoppingCart },
    { label: t('nav_drawings'), path: '/drawings', icon: FileImage },
    { label: t('nav_photos'), path: '/photos', icon: Camera },
    { label: t('nav_reports'), path: '/reports', icon: BarChart3 },
    { label: t('nav_users'), path: '/users', icon: UserCog },
    { label: 'Operarios', path: '/operarios', icon: Users },
    { label: 'Gastos', path: '/gastos-operarios', icon: Receipt },
    { label: 'Control Horario', path: '/control-horario', icon: Clock },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Partes</h1>
            <p className="text-xs text-muted-foreground">Gestión de trabajo</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Language selector */}
      <div className="px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Idioma</p>
        <div className="flex gap-1">
          {[['es', '🇪🇸 ES'], ['en', '🇬🇧 EN'], ['fr', '🇫🇷 FR']].map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={cn(
                'flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors',
                lang === code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Link
          to="/profile"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            location.pathname === '/profile'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <CircleUser className="w-4 h-4" />
          {t('nav_profile')}
        </Link>
      </div>
    </aside>
  );
}