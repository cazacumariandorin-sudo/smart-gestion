/**
 * VoiceInputButton — botón de dictado por voz con gestión de permisos.
 *
 * - Si el usuario desactiva el micrófono → se oculta en TODA la app
 * - Si el navegador deniega el permiso → muestra diálogo explicativo
 * - El usuario puede reactivar el micrófono desde el diálogo o desde Perfil
 */
import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function VoiceInputButton({ onResult, className, lang = 'es-ES' }) {
  const { listening, supported, desactivado, startListening, desactivarVoz } = useSpeechInput(lang);
  const [showDialog, setShowDialog] = useState(false);

  // No renderizar si no soportado o desactivado por el usuario
  if (!supported || desactivado) return null;

  const handleClick = () => {
    startListening(
      (text) => {
        onResult(text);
        toast.success('Dictado completado', { duration: 1500 });
      },
      () => {
        // Permiso denegado por el navegador → mostrar diálogo
        setShowDialog(true);
      }
    );
    if (!listening) {
      toast.info('Escuchando…', { duration: 2000, id: 'mic-listening' });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={listening ? 'Detener dictado' : 'Dictado por voz'}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-md border border-input shrink-0 transition-colors',
          listening
            ? 'bg-red-500 border-red-500 text-white animate-pulse'
            : 'bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground',
          className
        )}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* Diálogo cuando el navegador deniega el permiso */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MicOff className="w-5 h-5 text-amber-500" />
              Permiso de micrófono denegado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>El navegador no tiene permiso para usar el micrófono.</p>
                <p>Puedes:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>Activar el permiso en los ajustes del navegador y volver a intentarlo</li>
                  <li>Desactivar el micrófono en la app para que no vuelva a pedirte permiso</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowDialog(false)}>
              Cerrar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                desactivarVoz();
                setShowDialog(false);
                toast.info('Micrófono desactivado en la app. Puedes reactivarlo desde tu Perfil.', { duration: 4000 });
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Desactivar micrófono en la app
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}