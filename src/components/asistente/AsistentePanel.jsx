import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, CheckSquare, BarChart2, ShieldCheck, Settings, Lock, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/lib/useUserRole';
import AsistenteChat from './AsistenteChat';
import AsistenteTareas from './AsistenteTareas';
import AsistenteInformes from './AsistenteInformes';
import AsistenteConfigPanel from './AsistenteConfigPanel';

const TABS = [
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'tareas', label: 'Tareas', icon: CheckSquare },
  { id: 'informes', label: 'Informes', icon: BarChart2 },
  { id: 'normas', label: 'Normas', icon: ShieldCheck },
];

export default function AsistentePanel({ open, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [showSettings, setShowSettings] = useState(false);
  const { role } = useUserRole();

  const [bloqueado, setBloqueado] = useState(() =>
    localStorage.getItem('asistente_bloqueado') === '1'
  );
  const [autoOpenDesactivado, setAutoOpenDesactivado] = useState(() =>
    localStorage.getItem('asistente_no_autoopen') === '1'
  );

  const toggleBloqueado = (val) => {
    setBloqueado(val);
    localStorage.setItem('asistente_bloqueado', val ? '1' : '0');
    if (val) onClose();
  };

  const toggleAutoOpen = (val) => {
    setAutoOpenDesactivado(val);
    localStorage.setItem('asistente_no_autoopen', val ? '1' : '0');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay móvil */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel lateral */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full md:w-[380px] flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-slate-800 to-blue-800 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400/40 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-200" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Asistente SMART</h2>
                  <p className="text-[10px] text-blue-300">IA · Powered by Claude</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn('h-8 w-8 hover:bg-white/10', showSettings ? 'text-white bg-white/10' : 'text-blue-200 hover:text-white')}
                    onClick={() => setShowSettings(s => !s)}
                    title="Configuración del asistente"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>

                  {/* Popover de settings */}
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-10 z-50 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 space-y-3"
                      >
                        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1">Configuración del asistente</p>

                        {/* Bloquear asistente */}
                        <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors">
                          <Lock className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">Bloquear asistente</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Desactiva el botón flotante y el panel</p>
                          </div>
                          <Switch
                            checked={bloqueado}
                            onCheckedChange={toggleBloqueado}
                            className="shrink-0 mt-0.5"
                          />
                        </div>

                        {/* Bloquear inicio automático */}
                        <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors">
                          <BellOff className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">Desactivar inicio automático</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">No abrir el panel al arrancar la app</p>
                          </div>
                          <Switch
                            checked={autoOpenDesactivado}
                            onCheckedChange={toggleAutoOpen}
                            className="shrink-0 mt-0.5"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-200 hover:text-white hover:bg-white/10" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-slate-900 flex border-b border-slate-700 shrink-0">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                      activeTab === tab.id
                        ? 'text-blue-300 border-b-2 border-blue-400'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Contenido */}
            <div className="flex-1 bg-background overflow-hidden flex flex-col">
              {activeTab === 'chat' && <AsistenteChat currentUser={currentUser} />}
              {activeTab === 'tareas' && <AsistenteTareas currentUser={currentUser} onSwitchChat={() => setActiveTab('chat')} />}
              {activeTab === 'informes' && <AsistenteInformes currentUser={currentUser} />}
              {activeTab === 'normas' && <AsistenteConfigPanel currentUser={currentUser} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}