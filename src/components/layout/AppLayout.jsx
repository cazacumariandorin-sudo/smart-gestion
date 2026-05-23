import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import RoleSimulatorBanner from '@/components/RoleSimulatorBanner';
import DemoBanner from '@/components/demo/DemoBanner';
import DemoWatermark from '@/components/demo/DemoWatermark';
import ConnectivityBanner from './ConnectivityBanner';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useUserRole } from '@/lib/useUserRole';

function ScrollRestorer() {
  useScrollRestoration();
  return null;
}

export default function AppLayout() {
  const { isSimulating, isDemo } = useUserRole();
  const hasTopBanner = isSimulating || isDemo;
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScrollRestorer />
      <ConnectivityBanner />
      <RoleSimulatorBanner />
      <DemoBanner />
      <div className="flex flex-1 min-w-0">
        <Sidebar />
        <main
          className="flex-1 overflow-x-hidden main-with-bottom-nav"
          style={{
            paddingTop: (!hasTopBanner) ? 'env(safe-area-inset-top, 0px)' : undefined,
          }}
        >
          <Outlet />
        </main>
      </div>
      <DemoWatermark />
      <MobileNav />
    </div>
  );
}