import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackButton } from '@/hooks/useBackButton';

/**
 * LoadingOverlay — overlay semi-transparente de carga que nunca bloquea la navegación.
 * Uso: <LoadingOverlay show={isLoading} text="Cargando obra..." />
 */
export default function LoadingOverlay({ show, text = 'Cargando...', backTo }) {
  const { handleBack } = useBackButton({ backTo });

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.3)' }}
    >
      <div className="bg-card rounded-2xl px-6 py-5 shadow-xl flex flex-col items-center gap-2">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm font-medium">{text}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleBack} className="shadow-lg">
        Cancelar / Volver
      </Button>
    </div>
  );
}