/**
 * Botón de dictado por voz para adjuntar junto a un <Input>.
 * 
 * Uso:
 *   <div className="flex gap-1">
 *     <Input value={val} onChange={...} />
 *     <VoiceInputButton onResult={(txt) => setVal(prev => prev + txt)} />
 *   </div>
 * 
 * O con append=false para reemplazar:
 *   <VoiceInputButton onResult={(txt) => setVal(txt)} />
 */
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { toast } from 'sonner';

export default function VoiceInputButton({ onResult, className, lang = 'es-ES' }) {
  const { listening, supported, startListening } = useSpeechInput(lang);

  if (!supported) return null;

  const handleClick = () => {
    startListening((text) => {
      onResult(text);
    });
    if (!listening) {
      toast.info('Escuchando... habla ahora', { duration: 2000 });
    }
  };

  return (
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
  );
}