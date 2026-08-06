import { Fuel, MapPin, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Lugares genéricos — el técnico solo toca uno, sin teclear nada.
const LUGARES = [
  { id: 'gasolinera', label: 'Gasolinera', emoji: '⛽' },
  { id: 'obra', label: 'En obra', emoji: '🏗️' },
  { id: 'almacen', label: 'Almacén', emoji: '📦' },
  { id: 'oficina', label: 'Oficina', emoji: '🏢' },
  { id: 'ruta', label: 'En ruta', emoji: '🛣️' },
];

export default function RepostajeRapidoDialog({ vehiculo, open, onOpenChange, onSubmit, isSubmitting, tecnicoNombre }) {
  if (!vehiculo) return null;

  const handlePick = (lugar) => onSubmit(lugar);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-green-600" />
            Suministro de combustible
          </DialogTitle>
          <DialogDescription>
            Vehículo <strong>{vehiculo.matricula}</strong> · {vehiculo.modelo}.
            Selecciona dónde se repostó. Se registra a nombre de{' '}
            <strong>{tecnicoNombre || 'ti'}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isSubmitting ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            Registrando repostaje…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {LUGARES.map(l => (
              <Button
                key={l.id}
                variant="outline"
                className="h-auto py-4 flex-col gap-1 rounded-xl border-2 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 text-sm font-medium"
                onClick={() => handlePick(l.label)}
              >
                <span className="text-2xl leading-none">{l.emoji}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  {l.label}
                </span>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}