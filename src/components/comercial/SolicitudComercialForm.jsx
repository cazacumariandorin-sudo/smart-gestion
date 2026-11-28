import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const VACIO = { nombre: '', email: '', telefono: '', empresa: '', cif: '', cargo: '', mensaje: '' };

export default function SolicitudComercialForm({ planes = [], planInicial = '', origen = 'presentacion' }) {
  const [form, setForm] = useState({ ...VACIO, plan_interes: planInicial || planes[0]?.clave || 'completo' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviada, setEnviada] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.email.trim()) {
      setError('Indica tu nombre y tu email para poder responderte.');
      return;
    }
    setEnviando(true);
    try {
      await base44.entities.SolicitudComercial.create({
        ...form,
        origen,
        estado: 'nueva',
        historial: [
          {
            fecha: new Date().toISOString(),
            usuario_email: form.email,
            accion: 'solicitud_enviada',
            nota: `Origen: ${origen}`,
          },
        ],
      });
      setEnviada(true);
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviada) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" aria-hidden="true" />
        <h2 className="mt-3 font-semibold">Solicitud enviada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Te responderemos en {form.email}. Si quieres seguir viendo el producto, la demo está abierta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-xl border bg-card p-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Nombre y apellidos *</Label>
          <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
        </div>
        <div>
          <Label>Empresa</Label>
          <Input value={form.empresa} onChange={(e) => set('empresa', e.target.value)} autoComplete="organization" />
        </div>
        <div>
          <Label>CIF / NIF</Label>
          <Input value={form.cif} onChange={(e) => set('cif', e.target.value)} />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="tel" />
        </div>
        <div>
          <Label>Cargo</Label>
          <Input value={form.cargo} onChange={(e) => set('cargo', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Plan que te interesa</Label>
          <select
            value={form.plan_interes}
            onChange={(e) => set('plan_interes', e.target.value)}
            className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
          >
            {planes.map((p) => (
              <option key={p.clave} value={p.clave}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>¿Qué necesitas?</Label>
        <Textarea
          value={form.mensaje}
          onChange={(e) => set('mensaje', e.target.value)}
          rows={3}
          placeholder="Número de trabajadores, tipo de obra, qué usáis ahora…"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar solicitud
        </Button>
        <span className="text-[11px] text-muted-foreground">Sin compromiso. No se crea ninguna cuenta.</span>
      </div>
    </form>
  );
}