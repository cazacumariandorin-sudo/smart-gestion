import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Shield, X } from 'lucide-react';

/**
 * Aviso discreto no bloqueante para Admin/Gerencia
 * cuando hay reglas incumplidas o con decisión pendiente.
 * Se monta en AppLayout, comprueba en segundo plano.
 */
export default function ReglasDeOroAlert({ role }) {
  const [alerta, setAlerta] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!['admin', 'gerencia'].includes(role)) return;
    const key = `reglas_alert_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return; // Solo una vez por sesión/día

    const timer = setTimeout(async () => {
      try {
        const reglas = await base44.entities.ReglaDeOro.list('codigo', 200);
        const activas = reglas.filter(r => r.activa);
        const incumplidas = activas.filter(r => r.estado_cumplimiento === 'incumplida').length;
        const pendientes = activas.filter(r => r.decision_requerida && !r.decision_tomada).length;
        if (incumplidas > 0 || pendientes > 0) {
          setAlerta({ incumplidas, pendientes });
        }
      } catch (_) {}
    }, 8000); // 8s después del login, no bloqueante

    return () => clearTimeout(timer);
  }, [role]);

  if (!alerta || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-sm w-full mx-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-700 shadow-lg">
        <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Reglas de Oro</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {alerta.incumplidas > 0 && `${alerta.incumplidas} regla${alerta.incumplidas > 1 ? 's' : ''} incumplida${alerta.incumplidas > 1 ? 's' : ''}`}
            {alerta.incumplidas > 0 && alerta.pendientes > 0 && ' · '}
            {alerta.pendientes > 0 && `${alerta.pendientes} decisión${alerta.pendientes > 1 ? 'es' : ''} pendiente${alerta.pendientes > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          to={`/sistema/reglas-de-oro?filtro=${alerta.pendientes > 0 ? 'pendiente_decision' : 'incumplida'}`}
          className="text-xs text-amber-700 dark:text-amber-300 font-medium underline underline-offset-2 shrink-0"
          onClick={() => setDismissed(true)}
        >
          Ver
        </Link>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}