import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import ObraSelector from './ObraSelector';

export default function ObraObligatoriaModal({ open, onAsignarObra, onContinuarSinObra }) {
  const [seleccion, setSeleccion] = useState({ obra_id: '', obra_name: '', obra_tipo: '' });

  const handleAsignar = () => {
    if (!seleccion.obra_id) return;
    onAsignarObra(seleccion);
    setSeleccion({ obra_id: '', obra_name: '', obra_tipo: '' });
  };

  const handleSinObra = () => {
    setSeleccion({ obra_id: '', obra_name: '', obra_tipo: '' });
    onContinuarSinObra();
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Obra no asignada
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Este gasto no tiene una obra asignada. Es recomendable asociarlo a una obra para su seguimiento.
        </p>
        <ObraSelector
          value={seleccion.obra_id}
          obraName={seleccion.obra_name}
          obraTipo={seleccion.obra_tipo}
          onChange={({ obra_id, obra_name, obra_tipo }) => setSeleccion({ obra_id, obra_name, obra_tipo })}
        />
        <DialogFooter className="flex-col gap-2 sm:flex-row mt-2">
          <Button variant="ghost" onClick={handleSinObra} className="w-full sm:w-auto text-muted-foreground">
            Continuar sin obra
          </Button>
          <Button onClick={handleAsignar} disabled={!seleccion.obra_id} className="w-full sm:w-auto">
            Asignar y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}