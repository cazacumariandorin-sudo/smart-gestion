import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Plus, BarChart3, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Panel', path: '/', icon: LayoutDashboard },
  { label: 'Partes', path: '/work-orders', icon: ClipboardList },
  { label: 'Nuevo', path: '/work-orders/new', icon: Plus },
  { label: 'Fotos', path: '/photos', icon: Camera },
  { label: 'Informe', path: '/reports', icon: BarChart3 },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-1 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}