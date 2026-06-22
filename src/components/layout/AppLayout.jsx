import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import RoleSimulatorBanner from '@/components/RoleSimulatorBanner';
import DemoBanner from '@/components/demo/DemoBanner';
import DemoWatermark from '@/components/demo/DemoWatermark';
import ConnectivityBanner from './ConnectivityBanner';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';
import { Bot, Mic } from 'lucide-react';
import AsistentePanel from '@/components/asistente/AsistentePanel';
import OnboardingModal from '@/components/OnboardingModal';
import ReglasDeOroAlert from '@/components/gobernanza/ReglasDeOroAlert';
import { base44 } from '@/api/base44Client';

function ScrollRestorer() {
  useScrollRestoration();
  return null;
}

const VOICE_COMMAND = 'hola compañero';

export default function AppLayout() {
  const { isSimulating, isDemo } = useUserRole();
  const { user: authUser } = useAuth();
  const hasTopBanner = isSimulating || isDemo;
  const [asistenteOpen, setAsistenteOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [asistenteConfig, setAsistenteConfig] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.AsistenteConfig.filter({ clave: 'normas_globales' })
      .then(configs => { if (configs?.length > 0) setAsistenteConfig(configs[0]); })
      .catch(() => {});
  }, []);

  // Auto-abrir condicionado a la config de BD
  useEffect(() => {
    if (!asistenteConfig) return;
    if (!asistenteConfig.asistente_activo) return;
    if (!asistenteConfig.asistente_autoopen) return;
    if (sessionStorage.getItem('asistente_autoopen')) return;
    const t = setTimeout(() => {
      setAsistenteOpen(true);
      sessionStorage.setItem('asistente_autoopen', '1');
    }, 5000);
    return () => clearTimeout(t);
  }, [asistenteConfig]);

  // Reconocimiento de voz continuo — escucha "hola compañero"
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript.toLowerCase().trim())
        .join(' ');
      if (transcript.includes(VOICE_COMMAND)) {
        setAsistenteOpen(true);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') setVoiceActive(false);
    };

    recognition.onend = () => {
      // Reiniciar automáticamente para escucha continua
      try { recognition.start(); } catch (_) {}
    };

    try {
      recognition.start();
      setVoiceActive(true);
    } catch (_) {}

    return () => {
      recognition.onend = null;
      try { recognition.stop(); } catch (_) {}
    };
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

      {/* Botón flotante Asistente IA — condicionado a BD */}
      {asistenteConfig?.asistente_activo !== false && <button
        onClick={() => setAsistenteOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-blue-700 shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title={voiceActive ? 'Asistente SMART IA · Di "hola compañero" para activar' : 'Asistente SMART IA'}
      >
        <Bot className="w-5 h-5 text-white" />
        {voiceActive && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
            <Mic className="w-2 h-2 text-white" />
          </span>
        )}
      </button>}

      <AsistentePanel
        open={asistenteOpen}
        onClose={() => setAsistenteOpen(false)}
        currentUser={currentUser}
        asistenteConfig={asistenteConfig}
        onConfigChange={setAsistenteConfig}
      />

      {/* Onboarding obligatorio en el primer login */}
      {authUser && !authUser.onboarding_completado && (
        <OnboardingModal user={authUser} />
      )}

      {/* Alerta discreta de Reglas de Oro — solo Admin/Gerencia */}
      <ReglasDeOroAlert role={authUser?.role} />
    </div>
  );
}