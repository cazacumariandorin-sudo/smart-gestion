import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function DuplicadoConfirmModal({ open, onClose, duplicado, onUsarExistente, onCrearNuevo }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Posible duplicado
          </DialogTitle>
        </DialogHeader>
        {duplicado && (
          <p className="text-sm text-muted-foreground">
            Ya existe un registro muy similar: <strong className="text-foreground">{duplicado.name}</strong>{' '}
            ({Math.round(duplicado.similitud * 100)}% de similitud). ¿Qué deseas hacer?
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row mt-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button variant="secondary" onClick={onUsarExistente} className="w-full sm:w-auto">Usar existente</Button>
          <Button onClick={onCrearNuevo} className="w-full sm:w-auto">Crear nuevo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}