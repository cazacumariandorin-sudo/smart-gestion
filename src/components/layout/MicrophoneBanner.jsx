import { useState } from 'react';
import { Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const DURATION_OPTIONS = [
  { value: '1', label: '1 día' },
  { value: '3', label: '3 días' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: 'forever', label: 'Siempre' },
];

export default function MicrophoneBanner({ onDisable }) {
  const [duration, setDuration] = useState('7');

  const handleDisable = () => {
    onDisable(duration === 'forever' ? 'forever' : Number(duration));
  };

  return (
    <div className="fixed bottom-36 md:bottom-20 right-4 z-30 max-w-xs bg-card border border-border rounded-xl shadow-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Mic className="w-3.5 h-3.5 text-green-600" />
        </div>
        <p className="text-xs text-foreground flex-1">
          Asistente IA escuchando. Di <strong>"hola compañero"</strong> para activar
        </p>
      </div>
      <div className="flex items-center gap-2">
        <MobileSelect value={duration} onValueChange={setDuration} triggerClassName="h-8 text-xs flex-1">
          {DURATION_OPTIONS.map(o => (
            <MobileSelectItem key={o.value} value={o.value}>Desactivar durante {o.label}</MobileSelectItem>
          ))}
        </MobileSelect>
      </div>
      <Button variant="outline" size="sm" onClick={handleDisable} className="w-full gap-1.5 h-8 text-xs">
        <X className="w-3.5 h-3.5" /> Desactivar micrófono
      </Button>
    </div>
  );
}