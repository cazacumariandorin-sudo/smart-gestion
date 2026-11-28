import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';

const VACIO = {
  nombre_empresa: '', cif: '', actividad_principal: '', telefono: '',
  email_empresa: '', domicilio: '', localidad: '', provincia: '', codigo_postal: '',
  web: '', cargo: '', notas: '',
};

/** Solicitud de alta de una empresa. No concede acceso: queda pendiente de aprobación. */
export default function SolicitudEmpresaForm({ onEnviada }) {
  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const set = (clave, valor) => setForm((f) => ({ ...f, [clave]: valor }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await base44.functions.invoke('solicitarAltaEmpresa', form);
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      onEnviada?.(datos.solicitud);
      setForm(VACIO);
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la solicitud');
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="border rounded-xl p-4 bg-card space-y-3">
      <div>
        <div className="font-semibold">Dar de alta mi empresa</div>
        <p className="text-sm text-muted-foreground">
          Cuéntanos qué empresa representas. El propietario revisa la solicitud y, si la aprueba,
          recibirás una invitación para confirmar tu acceso como administrador.
        </p>
      </div>

      {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nombre o razón social *</Label>
          <Input value={form.nombre_empresa} onChange={(e) => set('nombre_empresa', e.target.value)} required />
        </div>
        <div>
          <Label>CIF / NIF *</Label>
          <Input value={form.cif} onChange={(e) => set('cif', e.target.value)} required />
        </div>
        <div>
          <Label>Actividad principal</Label>
          <Input value={form.actividad_principal} onChange={(e) => set('actividad_principal', e.target.value)} />
        </div>
        <div>
          <Label>Tu cargo en la empresa</Label>
          <Input value={form.cargo} onChange={(e) => set('cargo', e.target.value)} placeholder="Administrador" />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Email de la empresa</Label>
          <Input type="email" value={form.email_empresa} onChange={(e) => set('email_empresa', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Domicilio fiscal</Label>
          <Input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} />
        </div>
        <div>
          <Label>Código postal</Label>
          <Input value={form.codigo_postal} onChange={(e) => set('codigo_postal', e.target.value)} />
        </div>
        <div>
          <Label>Localidad</Label>
          <Input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} />
        </div>
        <div>
          <Label>Provincia</Label>
          <Input value={form.provincia} onChange={(e) => set('provincia', e.target.value)} />
        </div>
        <div>
          <Label>Web</Label>
          <Input value={form.web} onChange={(e) => set('web', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Notas para el propietario</Label>
          <Textarea rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={cargando}>
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {cargando ? 'Enviando…' : 'Enviar solicitud'}
      </Button>
    </form>
  );
}