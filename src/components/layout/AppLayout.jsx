import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';

function ScrollRestorer() {
  useScrollRestoration();
  return null;
}

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <ScrollRestorer />
      <Sidebar />
      <main
        className="flex-1 overflow-x-hidden pb-20 lg:pb-0"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}