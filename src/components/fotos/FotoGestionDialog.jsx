import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/AuthContext';

/**
 * ¿Puede este usuario borrar (lógicamente) esta foto?
 * RLS permite a admin/gerencia/jefe_obra y al propietario (created_by / created_by_id).
 */
export function puedeGestionarFoto(foto, user) {
  if (!user) return false;
  const role = user?.role;
  if (role === 'admin' || role === 'gerencia' || role === 'jefe_obra') return true;
  if (foto?.created_by && foto.created_by === user.email) return true;
  if (foto?.created_by_id && user.id && foto.created_by_id === user.id) return true;
  return false;
}

/**
 * Diálogo de borrado LÓGICO compartido por Galería (`/galeria-fotos`) y el panel
 * interno de obra (`ObraFotosPanel.jsx`). Marca la foto como `eliminada: true`
 * con trazabilidad de quién y cuándo; deja registros visibles para admin vía
 * restauración directa del campo.
 *
 * Props:
 *   foto        — registro FotoProyecto
 *   open        — boolean
 *   onOpenChange(open) — cierra el wrapper
 *   onDone()    — callback tras éxito (limpia selección en el padre)
 */
export default function FotoGestionDialog({ foto, open, onOpenChange, onDone }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  const handleDelete = async (e) => {
    if (e) e.preventDefault(); // evitar que el AlertDialog cierre antes de tiempo
    if (!foto) return;
    setPending(true);
    try {
      await base44.entities.FotoProyecto.update(foto.id, {
        eliminada: true,
        eliminada_por: user?.email || 'desconocido',
        fecha_eliminacion: new Date().toISOString(),
      });
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      if (foto?.proyecto_id) {
        qc.invalidateQueries({ queryKey: ['fotos-obra', foto.proyecto_id] });
      }
      onDone?.();
      onOpenChange?.(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar foto?</AlertDialogTitle>
          <AlertDialogDescription>
            La foto se marcará como eliminada y dejará de ser visible en la galería
            y en la obra. Se registra quién y cuándo la eliminó; un administrador
            puede restaurarla más adelante. No se borra físicamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}