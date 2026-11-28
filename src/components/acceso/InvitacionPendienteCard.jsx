import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Building2, Check, Loader2, X } from 'lucide-react';
import { TIPOS_INVITACION } from '@/lib/accesoEmpresa';
import { toast } from '@/components/ui/use-toast';

/** Invitación a una empresa: solo la persona invitada puede confirmarla o declinarla. */
export default function InvitacionPendienteCard({ invitacion, onResuelta }) {
  const [cargando, setCargando] = useState('');
  const [error, setError] = useState('');

  const resolver = async (accion) => {
    setError('');
    setCargando(accion);
    try {
      const res = await base44.functions.invoke('gestionarInvitacionAcceso', {
        accion,
        invitacion_id: invitacion.id,
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      if (accion === 'confirmar') {
        toast({
          title: `Acceso confirmado · ${invitacion.empresa_nombre}`,
          description: 'Ya trabajas dentro de tu empresa.',
        });
      } else {
        toast({ title: 'Invitación declinada' });
      }
      onResuelta?.(accion, datos);
    } catch (e) {
      setError(e?.message || 'No se pudo completar la acción');
    } finally {
      setCargando('');
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-card space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {TIPOS_INVITACION[invitacion.tipo] || 'Invitación'}
          </div>
          <div className="font-semibold leading-tight truncate">{invitacion.empresa_nombre}</div>
          <p className="text-sm text-muted-foreground">
            Te han invitado a trabajar en esta empresa. Al confirmar, tu acceso queda vinculado
            solo a ella y verás únicamente sus datos.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" onClick={() => resolver('confirmar')} disabled={!!cargando}>
          {cargando === 'confirmar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar acceso
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => resolver('rechazar')} disabled={!!cargando}>
          {cargando === 'rechazar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          No es mi empresa
        </Button>
      </div>
    </div>
  );
}