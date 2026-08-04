import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Power, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('getDiagnosticoData', { action, ...payload }).then(r => r.data);

const ROLES = [
  { value: 'soporte_it', label: 'Soporte IT' },
  { value: 'tecnico_it', label: 'Técnico IT' },
  { value: 'auditor_externo', label: 'Auditor externo' },
  { value: 'consultor', label: 'Consultor' }
];

const ROL_BADGE = {
  soporte_it: 'bg-blue-50 text-blue-700 border-blue-200',
  tecnico_it: 'bg-purple-50 text-purple-700 border-purple-200',
  auditor_externo: 'bg-amber-50 text-amber-700 border-amber-200',
  consultor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

function formatearFecha(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString('es-ES'); } catch { return s; }
}

export default function GestionAccesosDiagnostico({ accesos, loading }) {
  const [openNuevo, setOpenNuevo] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('tecnico_it');
  const [expira, setExpira] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const recargar = () => qc.invalidateQueries({ queryKey: ['diag-accesos'] });

  const handleCrear = async () => {
    if (!email) {
      toast({ variant: 'destructive', title: 'Email requerido' });
      return;
    }
    setEnviando(true);
    try {
      await LLAMAR('create_acceso', {
        user_email: email.trim().toLowerCase(),
        user_name: nombre.trim(),
        rol_asignado: rol,
        fecha_expiracion: expira ? new Date(expira).toISOString() : null,
        notas
      });
      toast({ title: 'Acceso autorizado ✓', description: `${email} ya puede ver el módulo de diagnóstico.` });
      setOpenNuevo(false);
      setEmail(''); setNombre(''); setRol('tecnico_it'); setExpira(''); setNotas('');
      recargar();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const handleToggle = async (a) => {
    try {
      await LLAMAR('update_acceso', { acceso_id: a.id, activo: !a.activo });
      toast({ title: a.activo ? 'Acceso desactivado' : 'Acceso reactivado' });
      recargar();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleEliminar = async (a) => {
    if (!confirm(`¿Eliminar el acceso de ${a.user_email}?`)) return;
    try {
      await LLAMAR('delete_acceso', { acceso_id: a.id });
      toast({ title: 'Acceso eliminado' });
      recargar();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Equipo de soporte IT</h3>
          <p className="text-[11px] text-muted-foreground">
            Estos usuarios podrán ver y comentar las incidencias reportadas sin necesidad de cambiarles el rol en el sistema.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpenNuevo(true)}>
          <UserPlus className="w-4 h-4" /> Nuevo
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando accesos...</p>}

      {!loading && accesos.length === 0 && (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-md">
          <p className="text-sm text-muted-foreground">No hay técnicos IT autorizados todavía.</p>
          <p className="text-xs text-muted-foreground mt-1">Pulsa "Nuevo" para autorizar el primero.</p>
        </div>
      )}

      <div className="space-y-2">
        {accesos.map(a => (
          <div key={a.id} className={cn('rounded-lg border p-3 bg-card', !a.activo && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold">{a.user_name || a.user_email}</span>
                  <Badge variant="outline" className={cn('text-[10px]', ROL_BADGE[a.rol_asignado])}>
                    {ROLES.find(r => r.value === a.rol_asignado)?.label || a.rol_asignado}
                  </Badge>
                  {!a.activo && <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">inactivo</Badge>}
                  {a.fecha_expiracion && new Date(a.fecha_expiracion) < new Date() && (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">expirado</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.user_email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Autorizado por {a.autorizado_por || '—'} · {formatearFecha(a.fecha_autorizacion)}
                  {a.fecha_expiracion ? ` · expira ${formatearFecha(a.fecha_expiracion)}` : ''}
                </p>
                {a.notas && <p className="text-[11px] mt-1 text-muted-foreground">{a.notas}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => handleToggle(a)} title={a.activo ? 'Desactivar' : 'Reactivar'}>
                  <Power className={cn('w-4 h-4', a.activo ? 'text-emerald-600' : 'text-muted-foreground')} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleEliminar(a)} title="Eliminar acceso">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openNuevo} onOpenChange={setOpenNuevo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Autorizar usuario IT</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Email del usuario (debe estar registrado en la app)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="soporte@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre / descripción</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Carlos — Soporte IT externo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rol en el módulo de diagnóstico</Label>
              <Select value={rol} onValueChange={setRol}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de expiración (opcional — vacío = sin caducidad)</Label>
              <Input type="date" value={expira} onChange={(e) => setExpira(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: contrato con ... para mantenimiento" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNuevo(false)}><X className="w-4 h-4" /> Cancelar</Button>
            <Button onClick={handleCrear} disabled={enviando}>
              {enviando ? 'Autorizando...' : 'Autorizar acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}