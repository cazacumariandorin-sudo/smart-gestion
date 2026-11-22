import { ArrowLeft } from 'lucide-react';
import { useBackButton } from '@/hooks/useBackButton';
import { cn } from '@/lib/utils';

/**
 * FloatingBackButton — botón flotante siempre visible para salir de una pantalla
 * bloqueada (carga larga o error). Uso: <FloatingBackButton show={isLoading || !!error} />
 */
export default function FloatingBackButton({ show, backTo, className, enableEsc = true }) {
  const { handleBack } = useBackButton({ backTo, enabled: enableEsc });

  if (!show) return null;

  return (
    <button
      onClick={handleBack}
      className={cn(
        'fixed bottom-20 left-4 md:bottom-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full',
        'bg-slate-900 text-white shadow-xl hover:scale-105 active:scale-95 transition-transform',
        className
      )}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-sm font-semibold">Volver</span>
    </button>
  );
}