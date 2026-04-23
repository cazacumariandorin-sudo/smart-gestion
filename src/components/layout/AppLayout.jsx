import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import RoleSimulatorBanner from '@/components/RoleSimulatorBanner';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useUserRole } from '@/lib/useUserRole';

function ScrollRestorer() {
  useScrollRestoration();
  return null;
}

export default function AppLayout() {
  const { isSimulating } = useUserRole();
  return (
    <div className="flex min-h-screen bg-background">
      <ScrollRestorer />
      <RoleSimulatorBanner />
      <Sidebar />
      <main
        className="flex-1 overflow-x-hidden pb-20 lg:pb-0"
        style={{
          paddingTop: isSimulating ? '2.5rem' : 'env(safe-area-inset-top, 0px)',
        }}
      >
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}