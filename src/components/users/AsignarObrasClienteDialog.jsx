import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Building2, Sun, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const clave = (tipo, id) => `${tipo}:${id}`;
const comoLista = (res) => (Array.isArray(res) ? res : res?.items || []);

/**
 * Asigna a un usuario cliente las obras que puede ver.
 * Mantiene dos cosas a la vez: el histórico (AsignacionObraCliente) y el campo
 * clientes_acceso de la obra, que es el que usa la regla de lectura.
 */
export default function AsignarObrasClienteDialog({ open, onOpenChange, user, onSuccess }) {
  const { user: authUser } = useUserRole();
  const [opciones, setOpciones] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [seleccion, setSeleccion] = useState(new Set());
  const [inicial, setInicial] = useState(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !user?.email) return;
    let cancelado = false;
    setCargando(true);
    setBusqueda('');
    Promise.all([
      base44.entities.Obra.list('-created_date', 300),
      base44.entities.SolarObra.list('-created_date', 300),
      base44.entities.AsignacionObraCliente.filter(
        { user_email: user.email, activo: true },
        { sort: '-created_date', limit: 300 }
      ),
    ])
      .then(([obras, solares, asigs]) => {
        if (cancelado) return;
        const lista = [
          ...(obras || []).map((o) => ({
            tipo: 'obra_civil',
            id: o.id,
            nombre: o.name || '',
            code: o.code || '',
            cliente: o.client_name || '',
            emails: Array.isArray(o.clientes_acceso) ? o.clientes_acceso : [],
          })),
          ...(solares || []).map((o) => ({
            tipo: 'solar',
            id: o.id,
            nombre: o.name || '',
            code: o.code || '',
            cliente: o.client_name || '',
            emails: Array.isArray(o.clientes_acceso) ? o.clientes_acceso : [],
          })),
        ];
        const asignadas = comoLista(asigs);
        const sel = new Set(asignadas.map((a) => clave(a.obra_tipo, a.obra_id)));
        setOpciones(lista);
        setAsignaciones(asignadas);
        setSeleccion(sel);
        setInicial(new Set(sel));
      })
      .catch((e) => toast.error(e?.message || 'No se pudieron cargar las obras'))
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, user?.email]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) =>
      `${o.nombre} ${o.code} ${o.cliente}`.toLowerCase().includes(q)
    );
  }, [opciones, busqueda]);

  const alternar = (opcion) => {
    const k = clave(opcion.tipo, opcion.id);
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const actualizarObra = (opcion, emails) =>
    opcion.tipo === 'solar'
      ? base44.entities.SolarObra.update(opcion.id, { clientes_acceso: emails })
      : base44.entities.Obra.update(opcion.id, { clientes_acceso: emails });

  const guardar = async () => {
    setGuardando(true);
    try {
      const anadidas = [...seleccion].filter((k) => !inicial.has(k));
      const quitadas = [...inicial].filter((k) => !seleccion.has(k));
      const porClave = new Map(opciones.map((o) => [clave(o.tipo, o.id), o]));
      const ahora = new Date().toISOString();

      for (const k of anadidas) {
        const obra = porClave.get(k);
        if (!obra) continue;
        await base44.entities.AsignacionObraCliente.create({
          user_email: user.email,
          user_id: user.id,
          user_name: user.full_name || '',
          obra_id: obra.id,
          obra_tipo: obra.tipo,
          obra_name: obra.nombre,
          activo: true,
          asignado_por: authUser?.email || '',
          asignado_en: ahora,
        });
        if (!obra.emails.includes(user.email)) {
          const emails = [...obra.emails, user.email];
          await actualizarObra(obra, emails);
          obra.emails = emails;
        }
      }

      for (const k of quitadas) {
        const obra = porClave.get(k);
        if (!obra) continue;
        const asignacion = asignaciones.find(
          (a) => a.obra_id === obra.id && a.obra_tipo === obra.tipo
        );
        if (asignacion) {
          await base44.entities.AsignacionObraCliente.update(asignacion.id, {
            activo: false,
            revocado_por: authUser?.email || '',
            revocado_en: ahora,
          });
        }
        const emails = obra.emails.filter((e) => e !== user.email);
        await actualizarObra(obra, emails);
        obra.emails = emails;
      }

      toast.success('Obras asignadas actualizadas');
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || 'No se pudieron guardar las asignaciones');
    } finally {
      setGuardando(false);
    }
  };

  const hayCambios =
    seleccion.size !== inicial.size ||
    [...seleccion].some((k) => !inicial.has(k));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Obras asignadas</DialogTitle>
          <DialogDescription>
            {user?.full_name || user?.email} solo verá las obras marcadas aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o cliente"
            className="pl-9"
          />
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-lg border divide-y">
          {cargando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay obras que coincidan
            </p>
          ) : (
            visibles.map((o) => {
              const k = clave(o.tipo, o.id);
              const activa = seleccion.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => alternar(o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    activa ? 'bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center ${
                      activa ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                    }`}
                  >
                    {activa && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {o.tipo === 'solar' ? (
                    <Sun className="h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <Building2 className="h-4 w-4 shrink-0 text-purple-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {o.nombre || 'Sin nombre'}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[o.code, o.cliente].filter(Boolean).join(' · ') || 'Sin referencia'}
                    </span>
                  </span>
                  {o.emails.length > 0 && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {o.emails.length} con acceso
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Desmarcar una obra retira el acceso en la siguiente carga y deja registro de la
          revocación. El cliente nunca ve obras sin asignar.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || cargando || !hayCambios}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar ({seleccion.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}