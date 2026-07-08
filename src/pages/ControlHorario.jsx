import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FichajesTab from '@/components/horario/FichajesTab';
import InformesTab from '@/components/horario/InformesTab';
import AlarmasTab from '@/components/horario/AlarmasTab';
import ApuntesTab from '@/components/horario/ApuntesTab';
import CierreForzadoPanel from '@/components/horario/CierreForzadoPanel';
import { Clock, BarChart3, Bell, ClipboardList, Zap } from 'lucide-react';
import { useAlarmas } from '@/hooks/useAlarmas';
import { useTabState } from '@/hooks/useTabState';
import { useUserRole } from '@/lib/useUserRole';

export default function ControlHorario() {
  const { isAdmin, isJefeObra, role } = useUserRole();
  const isOperario = role === 'operario';
  const isGerencia = role === 'gerencia';
  const showCierreForzado = isAdmin || isGerencia;
  const showAlarmas = isAdmin; // Alarmas solo para admin (RLS)
  const showApuntes = isAdmin || isJefeObra || isOperario || role === 'técnico'; // Operario/técnico pueden ver sus apuntes

  const { data: alarmas = [] } = useQuery({
    queryKey: ['alarmas'],
    queryFn: () => base44.entities.AlarmaHorario.list('hora', 100),
    enabled: isAdmin,
  });

  useAlarmas(alarmas);
  const [tab, setTab] = useTabState('control-horario', 'fichajes');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="w-7 h-7 text-primary" /> Control Horario
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Fichajes, informes y alarmas de operarios</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: 'fichajes', label: 'Fichajes',  icon: Clock,        color: 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-blue-200', show: true },
            { value: 'informes', label: 'Informes',  icon: BarChart3,    color: 'bg-teal-500 hover:bg-teal-600 border-teal-600 shadow-teal-200', show: true },
            { value: 'apuntes',  label: 'Apuntes',   icon: ClipboardList,color: 'bg-indigo-500 hover:bg-indigo-600 border-indigo-600 shadow-indigo-200', show: showApuntes },
            { value: 'alarmas',  label: 'Alarmas',   icon: Bell,         color: 'bg-rose-500 hover:bg-rose-600 border-rose-600 shadow-rose-200', show: showAlarmas },
            { value: 'cierre-forzado', label: 'Cierre Forzado', icon: Zap, color: 'bg-amber-500 hover:bg-amber-600 border-amber-600 shadow-amber-200', show: showCierreForzado },
          ].filter(t => t.show).map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={[
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm text-white shadow-md',
                'transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95',
                color,
                tab === value ? 'ring-2 ring-offset-2 ring-current scale-105 shadow-lg' : 'opacity-80',
              ].join(' ')}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <TabsList className="hidden">
          <TabsTrigger value="fichajes" />
          <TabsTrigger value="informes" />
          <TabsTrigger value="apuntes" />
          <TabsTrigger value="alarmas" />
          {showCierreForzado && <TabsTrigger value="cierre-forzado" />}
        </TabsList>

        <TabsContent value="fichajes"><FichajesTab /></TabsContent>
        <TabsContent value="informes"><InformesTab /></TabsContent>
        <TabsContent value="apuntes"><ApuntesTab /></TabsContent>
        <TabsContent value="alarmas"><AlarmasTab /></TabsContent>
        {showCierreForzado && (
          <TabsContent value="cierre-forzado">
            <CierreForzadoPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}