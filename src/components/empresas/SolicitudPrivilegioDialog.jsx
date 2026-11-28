import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROLES_SOLICITABLES, etiquetaRol } from '@/lib/multiempresa';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Alta de una solicitud de privilegios dirigida al propietario de la app.
 */
export default function SolicitudPrivilegioDialog({ onClose }) {
  const { user } = useUserRole();
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    empresa_id: '',
    usuario_email: '',
    usuario_nombre: '',
    rol_actual: 'usuario_demo',
    rol_solicitado: 'técnico',
    motivo: '',
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('-created_date', 100),
  });
  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-empresa'],
    queryFn: () => base44.entities.EspacioEmpresa.list('-created_date', 200),
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const guardar = async () => {
    const empresa = empresas.find((e) => e.id === form.empresa_id);
    if (!empresa || !form.usuario_email || !form.rol_solicitado || !form.motivo.trim()) {
      toast({ title: 'Faltan datos', description: 'Empresa, usuario, rol solicitado y motivo son obligatorios.', variant: 'destructive' });
      return;
    }
    setGuardando(true);
    try {
      const espacio = espacios.find((e) => e.empresa_id === empresa.id) || null;
      const ahora = new Date().toISOString();
      await base44.entities.SolicitudPrivilegio.create({
        espacio_id: espacio?.id || '',
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre || '',
        solicitante_email: user?.email || '',
        solicitante_nombre: user?.full_name || user?.email || '',
        usuario_email: form.usuario_email,
        usuario_nombre: form.usuario_nombre,
        rol_actual: form.rol_actual,
        rol_solicitado: form.rol_solicitado,
        motivo: form.motivo.trim(),
        estado: 'pendiente',
        historial: [{
          fecha: ahora,
          usuario_email: user?.email || '',
          accion: 'Solicitud creada',
          estado_anterior: null,
          estado_nuevo: 'pendiente',
          nota: form.motivo.trim(),
        }],
      });
      qc.invalidateQueries({ queryKey: ['solicitudes-privilegio'] });
      toast({ title: 'Solicitud enviada', description: 'Queda pendiente de la decisión del propietario.' });
      onClose();
    } catch (e) {
      toast({ title: 'No se pudo crear la solicitud', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de privilegios</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Empresa solicitante *</Label>
            <select className="ing-input" value={form.empresa_id} onChange={(e) => set('empresa_id', e.target.value)}>
              <option value="">Selecciona empresa…</option>
              {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label>Usuario afectado (email) *</Label>
            <Input type="email" value={form.usuario_email} onChange={(e) => set('usuario_email', e.target.value)} />
          </div>
          <div>
            <Label>Nombre del usuario</Label>
            <Input value={form.usuario_nombre} onChange={(e) => set('usuario_nombre', e.target.value)} />
          </div>
          <div>
            <Label>Rol actual</Label>
            <select className="ing-input" value={form.rol_actual} onChange={(e) => set('rol_actual', e.target.value)}>
              {ROLES_SOLICITABLES.map((rol) => <option key={rol} value={rol}>{etiquetaRol(rol)}</option>)}
            </select>
          </div>
          <div>
            <Label>Rol solicitado *</Label>
            <select className="ing-input" value={form.rol_solicitado} onChange={(e) => set('rol_solicitado', e.target.value)}>
              {ROLES_SOLICITABLES.map((rol) => <option key={rol} value={rol}>{etiquetaRol(rol)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Motivo *</Label>
            <Textarea value={form.motivo} onChange={(e) => set('motivo', e.target.value)} rows={3}
              placeholder="Qué necesita hacer y por qué requiere ese rol." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {guardando ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}