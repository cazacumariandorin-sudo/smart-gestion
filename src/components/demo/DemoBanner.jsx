import { useUserRole } from '@/lib/useUserRole';
import { FlaskConical, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DemoBanner() {
  const { isDemo, user, isDemoExpired } = useUserRole();

  if (!isDemo) return null;

  const expiresAt = user?.demo_expires_at ? new Date(user.demo_expires_at) : null;
  const daysLeft = expiresAt ? differenceInDays(expiresAt, new Date()) : null;
  const isUrgent = daysLeft !== null && daysLeft <= 3;

  return (
    <div className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium z-40 ${
      isDemoExpired
        ? 'bg-destructive text-destructive-foreground'
        : isUrgent
        ? 'bg-amber-500 text-white'
        : 'bg-primary text-primary-foreground'
    }`}>
      {isDemoExpired
        ? <AlertTriangle className="w-4 h-4 shrink-0" />
        : <FlaskConical className="w-4 h-4 shrink-0" />
      }
      <span className="flex-1">
        {isDemoExpired
          ? 'Tu acceso demo ha expirado. Contacta con el administrador para ampliar el acceso.'
          : (
            <>
              Estás usando la <strong>versión demo</strong> — tus datos son independientes y no afectan a la aplicación real.
              {expiresAt && (
                <span className="ml-2 inline-flex items-center gap-1 opacity-90">
                  <Clock className="w-3.5 h-3.5" />
                  Acceso válido hasta {format(expiresAt, "d MMM yyyy", { locale: es })}
                  {daysLeft !== null && daysLeft >= 0 && (
                    <span className="ml-1 font-bold">({daysLeft === 0 ? 'hoy expira' : `${daysLeft}d restantes`})</span>
                  )}
                </span>
              )}
            </>
          )
        }
      </span>
    </div>
  );
}