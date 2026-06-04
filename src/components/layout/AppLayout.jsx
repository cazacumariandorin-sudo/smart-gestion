import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import RoleSimulatorBanner from '@/components/RoleSimulatorBanner';
import DemoBanner from '@/components/demo/DemoBanner';
import DemoWatermark from '@/components/demo/DemoWatermark';
import ConnectivityBanner from './ConnectivityBanner';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useUserRole } from '@/lib/useUserRole';
import { Bot } from 'lucide-react';
import AsistentePanel from '@/components/asistente/AsistentePanel';
import { base44 } from '@/api/base44Client';

function ScrollRestorer() {
  useScrollRestoration();
  return null;
}

export default function AppLayout() {
  const { isSimulating, isDemo } = useUserRole();
  const hasTopBanner = isSimulating || isDemo;
  const [asistenteOpen, setAsistenteOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

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

      {/* Botón flotante Asistente IA */}
      <button
        onClick={() => setAsistenteOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-blue-700 shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="Asistente SMART IA"
      >
        <Bot className="w-5 h-5 text-white" />
      </button>

      <AsistentePanel
        open={asistenteOpen}
        onClose={() => setAsistenteOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}