import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { clearSimulatedRole } from '@/lib/roleSimulator';
import { useUserRole } from '@/lib/useUserRole';

const roleLabels = {
  admin: 'Administrador',
  jefe_obra: 'Jefe de Obra',
  operario: 'Operario',
  control_horario: 'Control Horario',
  cliente_obra: 'Cliente Obra',
};

export default function RoleSimulatorBanner() {
  const { isSimulating, simulatedRole } = useUserRole();
  const navigate = useNavigate();

  if (!isSimulating) return null;

  const stop = () => {
    clearSimulatedRole();
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-semibold shadow-lg">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 shrink-0" />
        <span>Simulando rol: <strong>{roleLabels[simulatedRole] || simulatedRole}</strong></span>
      </div>
      <button
        onClick={stop}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1 text-xs font-bold"
      >
        <X className="w-3.5 h-3.5" /> Salir simulación
      </button>
    </div>
  );
}