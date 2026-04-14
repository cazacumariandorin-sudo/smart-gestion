import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Plus, HardHat, Users, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Panel', path: '/', icon: LayoutDashboard },
  { label: 'Clientes', path: '/clients', icon: Users },
  { label: 'Partes de Trabajo', path: '/work-orders', icon: ClipboardList },
  { label: 'Nuevo Parte', path: '/work-orders/new', icon: Plus },
  { label: 'Informe Mensual', path: '/reports', icon: BarChart3 },
];

export default function Sidebar() {
  const location = useLocation();

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
      <nav className="flex-1 p-4 space-y-1">
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
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}