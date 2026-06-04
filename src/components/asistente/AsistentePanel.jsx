import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Send, CheckSquare, BarChart2, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/lib/useUserRole';
import AsistenteChat from './AsistenteChat';
import AsistenteTareas from './AsistenteTareas';
import AsistenteInformes from './AsistenteInformes';

const TABS = [
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'tareas', label: 'Tareas', icon: CheckSquare },
  { id: 'informes', label: 'Informes', icon: BarChart2 },
];

export default function AsistentePanel({ open, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('chat');
  const { role } = useUserRole();

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
              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-200 hover:text-white hover:bg-white/10" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}