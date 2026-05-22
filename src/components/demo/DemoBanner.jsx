import { useUserRole } from '@/lib/useUserRole';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DemoBanner() {
  const { isDemo, user, isDemoExpired } = useUserRole();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  const expiresAt = user?.demo_expires_at ? new Date(user.demo_expires_at) : null;
  const now = new Date();
  const daysLeft = expiresAt ? differenceInDays(expiresAt, now) : null;
  const isExpired = expiresAt && expiresAt < now;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

  if (isExpired) {
    // Bloquear acceso completamente
    if (typeof window !== 'undefined') {
      window.location.href = '/profile';
    }
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-6 max-w-sm w-full space-y-4 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Período demo finalizado</h2>
          <p className="text-muted-foreground text-sm">
            Tu cuenta demo ha expirado. Contacta con nosotros para obtener acceso completo.
          </p>
          <Button onClick={() => window.location.href = '/profile'} className="w-full">
            Ir a mi perfil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 shadow-lg ${isExpiringSoon ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {isExpiringSoon ? '⚠️ Tu acceso demo expira en ' + daysLeft + ' días' : '⚠️ Modo demo'}
            </p>
            {expiresAt && (
              <p className="text-xs opacity-90">
                {isExpiringSoon 
                  ? 'Fecha límite: ' + format(expiresAt, 'dd/MM/yyyy')
                  : 'Tus registros son independientes y no afectan los datos reales. Acceso válido hasta: ' + format(expiresAt, 'dd/MM/yyyy')}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/10 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}