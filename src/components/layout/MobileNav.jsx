import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Plus, BarChart3, Camera, Package, ShoppingCart, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export default function MobileNav() {
  const location = useLocation();
  const { t } = useI18n();

  const navItems = [
    { labelKey: 'nav_dashboard', path: '/', icon: LayoutDashboard },
    { labelKey: 'nav_workorders', path: '/work-orders', icon: ClipboardList, label: 'Partes' },
    { labelKey: 'nav_new_order', path: '/work-orders/new', icon: Plus, label: 'Nuevo' },
    { labelKey: 'nav_orders', path: '/orders', icon: ShoppingCart, label: 'Pedidos' },
    { labelKey: 'nav_materials', path: '/materials', icon: Package, label: 'Materiales' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-1 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const label = item.label || t(item.labelKey);
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
              <span className="text-[9px] font-medium truncate max-w-12 text-center">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}