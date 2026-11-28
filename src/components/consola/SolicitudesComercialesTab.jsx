import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ArrowRightLeft, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { PLANES } from '@/lib/planes';

const ESTADOS = {
  nueva: { label: 'Nueva', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  contactada: { label: 'Contactada', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprobada: { label: 'Aprobada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazada: { label: 'Rechazada', className: 'bg-red-50 text-red-700 border-red-200' },
  convertida: { label: 'Convertida', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function SolicitudesComercialesTab() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [convirtiendo, setConvirtiendo] = useState(null);
  const [ocupado, setOcupado] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await base44.entities.SolicitudComercial.list('-created_date', 100);
      setSolicitudes(Array.isArray(lista) ? lista : []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = filtro === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === filtro);

  const cambiarEstado = async (s, estado) => {
    setOcupado(s.id);
    try {
      await base44.entities.SolicitudComercial.update(s.id, {
        estado,
        historial: [
          ...(s.historial || []),
          { fecha: new Date().toISOString(), usuario_email: user?.email || '', accion: estado, nota: '' },
        ],
      });
      cargar();
    } catch (e) {
      toast({ title: 'No se pudo actualizar', description: e?.message, variant: 'destructive' });
    } finally {
      setOcupado('');
    }
  };

  const convertir = async () => {
    const s = convirtiendo;
    if (!s) return;
    setOcupado(s.id);
    try {
      const res = await base44.functions.invoke('decidirSolicitudEmpresa', {
        decision: 'aprobar',
        empresa: {
          nombre_empresa: s.empresa || s.nombre,
          cif: s.cif,
          actividad_principal: '',
          telefono: s.telefono || '',
          email_empresa: s.email || '',
        },
        admin_local_email: s.email,
        admin_local_nombre: s.nombre,
        cargo: s.cargo || 'Administrador local',
        comentario: `Solicitud comercial convertida · plan ${s.plan_interes || 'completo'}`,
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);

      if (datos.empresa_id) {
        await base44.entities.PlanEmpresa.create({
          empresa_id: datos.empresa_id,
          empresa_nombre: s.empresa || s.nombre,
          plan: s.plan_interes || 'completo',
          activo: true,
          actualizado_por: user?.email || '',
          actualizado_en: new Date().toISOString(),
        });
      }

      await base44.entities.SolicitudComercial.update(s.id, {
        estado: 'convertida',
        empresa_id: datos.empresa_id || '',
        empresa_nombre: s.empresa || s.nombre,
        plan_asignado: s.plan_interes || 'completo',
        solicitud_empresa_id: datos.solicitud?.id || '',
        historial: [
          ...(s.historial || []),
          {
            fecha: new Date().toISOString(),
            usuario_email: user?.email || '',
            accion: 'convertida',
            nota: `Invitación enviada a ${datos.admin_local_email || s.email}`,
          },
        ],
      });

      toast({
        title: 'Empresa creada e invitación enviada',
        description: `El acceso se abre cuando ${datos.admin_local_email || s.email} confirme la invitación.`,
      });
      setConvirtiendo(null);
      cargar();
    } catch (e) {
      toast({ title: 'No se pudo convertir', description: e?.message, variant: 'destructive' });
    } finally {
      setOcupado('');
    }
  };

  if (cargando) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="todas">Todas ({solicitudes.length})</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>{v.label} ({solicitudes.filter((s) => s.estado === k).length})</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Convertir crea la empresa y su invitación; el acceso no se abre hasta que la persona la confirme.
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay solicitudes en este estado.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((s) => {
            const estado = ESTADOS[s.estado] || ESTADOS.nueva;
            return (
              <div key={s.id} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight truncate">{s.nombre}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {s.empresa || 'Sin empresa'} · {s.email}
                    </div>
                  </div>
                  <span className={`text-[11px] rounded-full border px-2 py-0.5 shrink-0 ${estado.className}`}>{estado.label}</span>
                </div>

                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <span className="rounded-full border bg-muted/40 px-1.5 py-0.5">Plan: {s.plan_interes || '—'}</span>
                  <span className="rounded-full border bg-muted/40 px-1.5 py-0.5">Origen: {s.origen || 'presentacion'}</span>
                  {s.telefono && <span className="rounded-full border bg-muted/40 px-1.5 py-0.5">{s.telefono}</span>}
                </div>

                {s.mensaje && <p className="text-xs text-muted-foreground line-clamp-3">{s.mensaje}</p>}

                {s.estado !== 'convertida' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => cambiarEstado(s, 'contactada')} disabled={ocupado === s.id}>
                      <Mail className="h-3.5 w-3.5" /> Contactada
                    </Button>
                    <Button size="sm" onClick={() => setConvirtiendo({ ...s })} disabled={ocupado === s.id}>
                      {ocupado === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                      Convertir en empresa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cambiarEstado(s, 'rechazada')} disabled={ocupado === s.id}>
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
                    </Button>
                  </div>
                )}

                {s.estado === 'convertida' && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Empresa {s.empresa_nombre} · plan {s.plan_asignado}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!convirtiendo} onOpenChange={(abierto) => { if (!abierto) setConvirtiendo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convertir en empresa</DialogTitle>
          </DialogHeader>
          {convirtiendo && (
            <div className="space-y-3">
              <div>
                <Label>Empresa</Label>
                <Input
                  value={convirtiendo.empresa || ''}
                  onChange={(e) => setConvirtiendo({ ...convirtiendo, empresa: e.target.value })}
                />
              </div>
              <div>
                <Label>CIF / NIF</Label>
                <Input
                  value={convirtiendo.cif || ''}
                  onChange={(e) => setConvirtiendo({ ...convirtiendo, cif: e.target.value })}
                />
              </div>
              <div>
                <Label>Administrador local</Label>
                <Input
                  type="email"
                  value={convirtiendo.email || ''}
                  onChange={(e) => setConvirtiendo({ ...convirtiendo, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Plan comercial</Label>
                <select
                  value={convirtiendo.plan_interes || 'completo'}
                  onChange={(e) => setConvirtiendo({ ...convirtiendo, plan_interes: e.target.value })}
                  className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {PLANES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se crea la empresa y su espacio, y se envía la invitación. Nadie entra hasta que esa persona
                la confirme.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvirtiendo(null)}>Cancelar</Button>
            <Button
              onClick={convertir}
              disabled={ocupado === convirtiendo?.id || !convirtiendo?.cif || !convirtiendo?.email}
            >
              {ocupado === convirtiendo?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crear empresa e invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}