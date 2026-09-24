import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AutoCorrectInput from '@/components/ui/AutoCorrectInput';
import { Loader2, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * ReabrirCicloDialog — Reapertura de ciclo cerrado para auditoría.
 * Doble autenticación: rol gerencia/administración + PIN (secret REAPERTURA_CICLO_PIN).
 */
export default function ReabrirCicloDialog({ open, onClose, nota, onReopened }) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleReabrir = async () => {
    if (!pin.trim()) { toast.error('Introduce el PIN de reapertura'); return; }
    if (!motivo.trim()) { toast.error('Indica el motivo de auditoría'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('reabrirCicloGasto', {
        nota_id: nota.id,
        pin: pin.trim(),
        motivo: motivo.trim(),
      });
      toast.success(`Ciclo reabierto por ${res.reabierto_por || 'gerencia'}. El operario puede añadir gastos de nuevo.`);
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      setPin(''); setMotivo('');
      onReopened?.(nota);
      onClose();
    } catch (e) {
      toast.error(e.message || 'No se pudo reabrir el ciclo');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setPin(''); setMotivo(''); onClose(); };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Reabrir ciclo para auditoría
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block font-mono text-xs bg-muted px-2 py-1 rounded">{nota?.numero_ciclo || nota?.ciclo_mes}</span>
            <span className="block">Requiere <strong>doble autenticación</strong>: rol Gerencia/Administración + PIN de reapertura.</span>
            <span className="block text-xs">El operario podrá añadir gastos a este ciclo de nuevo. La reapertura queda registrada para auditoría.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> PIN de reapertura *</Label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={8}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo de auditoría *</Label>
            <AutoCorrectInput
              placeholder="Ej: Gasto omitido detectado, corrección de importe…"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">El motivo queda registrado con tu usuario y la fecha de reapertura.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleReabrir} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            {loading ? 'Reabriendo…' : 'Reabrir ciclo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}