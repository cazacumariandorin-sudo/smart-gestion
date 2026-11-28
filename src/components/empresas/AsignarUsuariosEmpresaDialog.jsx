import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, UserCheck } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Asigna usuarios a la empresa del espacio. Al moverlos, su ficha laboral y sus
 * datos sensibles viajan con ellos: dejan de ser visibles para la empresa anterior.
 */
export default function AsignarUsuariosEmpresaDialog({ empresa, onClose }) {
  const qc = useQueryClient();
  const [seleccionado, setSeleccionado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios-empresa', empresa.id],
    queryFn: () => base44.entities.User.list(),
  });

  const asignar = async () => {
    const destino = usuarios.find((u) => u.email === seleccionado);
    if (!destino) return;
    setGuardando(true);
    try {
      const res = await base44.functions.invoke('asignarEmpresaUsuario', {
        user_email: destino.email,
        empresa_id: empresa.id,
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      qc.invalidateQueries({ queryKey: ['usuarios-empresa'] });
      qc.invalidateQueries({ queryKey: ['empresas'] });
      toast({
        title: `${destino.full_name || destino.email} → ${empresa.nombre}`,
        description: `${datos.operarios_movidos || 0} ficha(s) laboral(es) y ${datos.datos_sensibles_movidos || 0} registro(s) de datos movidos.`,
      });
      onClose();
    } catch (e) {
      toast({ title: 'No se pudo asignar', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Usuarios de {empresa.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Usuario a asignar</Label>
            <select
              className="ing-input"
              value={seleccionado}
              onChange={(e) => setSeleccionado(e.target.value)}
              disabled={isLoading}
            >
              <option value="">{isLoading ? 'Cargando usuarios…' : 'Selecciona un usuario…'}</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.email}>
                  {(u.full_name || u.email) + (u.empresa_nombre ? ` · ${u.empresa_nombre}` : ' · sin empresa')}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <UserCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Al asignarlo, su perfil laboral y sus datos personales pasan a esta empresa y dejan de verse desde la anterior.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={asignar} disabled={!seleccionado || guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {guardando ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}