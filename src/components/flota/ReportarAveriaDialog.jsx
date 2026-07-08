import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const TIPOS_AVERIA = [
  { value: 'averia_motor', label: 'Avería de motor' },
  { value: 'averia_frenos', label: 'Frenos' },
  { value: 'averia_electrica', label: 'Eléctrica / batería' },
  { value: 'testigo_panel', label: 'Testigo encendido en el panel' },
  { value: 'otra_incidencia', label: 'Otra incidencia' },
];

const URGENCIAS = ['baja', 'media', 'alta', 'critica'];

export default function ReportarAveriaDialog({ vehiculo, open, onOpenChange, onSubmit, isSubmitting }) {
  const [tipo, setTipo] = useState('averia_motor');
  const [urgencia, setUrgencia] = useState('alta');
  const [descripcion, setDescripcion] = useState('');

  const handleClose = (o) => {
    if (!o) { setTipo('averia_motor'); setUrgencia('alta'); setDescripcion(''); }
    onOpenChange(o);
  };

  const handleSubmit = () => {
    if (!descripcion.trim()) return;
    onSubmit({ tipo, urgencia, descripcion });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar avería — {vehiculo?.matricula}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de incidencia</Label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {TIPOS_AVERIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Urgencia</Label>
            <select
              value={urgencia}
              onChange={e => setUrgencia(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm capitalize"
            >
              {URGENCIAS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[90px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe la avería o el aviso que ha saltado en el panel..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !descripcion.trim()} className="gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enviar aviso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}