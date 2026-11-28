import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, LogIn, Loader2, Settings2, Star, CheckCircle2, XCircle, Search, ShieldCheck,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEmpresaActiva } from '@/lib/EmpresaActivaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { getPlan, modulosDelPlan, MODULO_LABELS, PLANES } from '@/lib/planes';

const TODOS = Object.keys(MODULO_LABELS);

const PLAN_COLOR = {
  completo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  control_horario: 'bg-blue-50 text-blue-700 border-blue-200',
  cliente_obra: 'bg-purple-50 text-purple-700 border-purple-200',
  legal: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ESTADO_ESPACIO = {
  activo: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  configurado: { label: 'Configurado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  pendiente_configuracion: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  suspendido: { label: 'Suspendido', className: 'bg-red-50 text-red-700 border-red-200' },
};

export default function EmpresasConsolaTab() {
  const { user } = useAuth();
  const { empresa, entrarEmpresa } = useEmpresaActiva();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null);
  const [planKey, setPlanKey] = useState('completo');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [e, p, s] = await Promise.all([
        base44.entities.Empresa.list('-created_date', 200),
        base44.entities.PlanEmpresa.list('-created_date', 300),
        base44.entities.EspacioEmpresa.list('-created_date', 200),
      ]);
      setEmpresas(Array.isArray(e) ? e : []);
      setPlanes(Array.isArray(p) ? p : []);
      setEspacios(Array.isArray(s) ? s : []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const planDe = useMemo(
    () => (id) => planes.find((p) => p.empresa_id === id && p.activo !== false) || null,
    [planes],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) =>
      [e.nombre, e.cif, e.email, e.localidad].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [empresas, busqueda]);

  const resumen = useMemo(() => ({
    total: empresas.length,
    conPlan: empresas.filter((e) => planDe(e.id)).length,
    activos: espacios.filter((e) => e.estado === 'activo').length,
  }), [empresas, espacios, planDe]);

  const abrirPlan = (emp) => {
    setEditando(emp);
    setPlanKey(planDe(emp.id)?.plan || 'completo');
  };

  const guardarPlan = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      const existente = planDe(editando.id);
      const payload = {
        empresa_id: editando.id,
        empresa_nombre: editando.nombre,
        plan: planKey,
        activo: true,
        actualizado_por: user?.email || '',
        actualizado_en: ahora,
      };
      if (existente) await base44.entities.PlanEmpresa.update(existente.id, payload);
      else await base44.entities.PlanEmpresa.create(payload);

      const espacio = espacios.find((e) => e.empresa_id === editando.id);
      if (espacio) {
        await base44.entities.EspacioEmpresa.update(espacio.id, {
          plan: planKey,
          actualizado_por: user?.email || '',
          actualizado_en: ahora,
        });
      }
      toast({ title: `Plan actualizado: ${getPlan(planKey).label}` });
      setEditando(null);
      cargar();
    } catch (e) {
      toast({ title: 'No se pudo guardar el plan', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  const entrar = (emp) => {
    entrarEmpresa(emp.id);
    navigate('/');
  };

  if (cargando) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!empresas.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No hay empresas registradas todavía.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empresa, CIF o email"
            className="pl-9"
            aria-label="Buscar empresa"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full border bg-muted/40 px-2 py-1">{resumen.total} empresas</span>
          <span className="rounded-full border bg-muted/40 px-2 py-1">{resumen.conPlan} con plan</span>
          <span className="rounded-full border bg-muted/40 px-2 py-1">{resumen.activos} espacios activos</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
        Entrar abre el espacio de esa empresa con tus privilegios de propietario. Cada espacio es
        independiente: sus datos no se mezclan con los de otra empresa y puedes volver aquí desde la franja superior.
      </p>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ninguna empresa coincide con «{busqueda}».</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((emp) => {
            const registroPlan = planDe(emp.id);
            const key = registroPlan?.plan || 'completo';
            const plan = getPlan(key);
            const modulos = modulosDelPlan(key) || TODOS;
            const espacio = espacios.find((e) => e.empresa_id === emp.id);
            const estadoEspacio = espacio ? ESTADO_ESPACIO[espacio.estado] : null;
            const abierta = empresa?.id === emp.id;
            return (
              <div
                key={emp.id}
                className={`rounded-xl border bg-card p-4 flex flex-col gap-3 ${abierta ? 'ring-2 ring-primary/60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {emp.logo_url ? (
                    <img src={emp.logo_url} alt={emp.nombre} className="h-9 w-9 rounded-lg object-contain bg-white border" />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight truncate flex items-center gap-1">
                      {emp.nombre}
                      {emp.es_principal && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" aria-label="Empresa principal" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {emp.cif || 'sin CIF'}{emp.localidad ? ` · ${emp.localidad}` : ''}
                    </div>
                  </div>
                  {emp.activa ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="Empresa activa" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-label="Empresa inactiva" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Plan</span>
                    {registroPlan ? (
                      <span className={`text-[11px] rounded-full border px-2 py-0.5 ${PLAN_COLOR[key] || PLAN_COLOR.completo}`}>
                        {plan.label}
                      </span>
                    ) : (
                      <span className="text-[11px] rounded-full border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                        Sin plan asignado
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {modulos.slice(0, 5).map((m) => (
                      <span key={m} className="text-[10px] rounded-full border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                        {MODULO_LABELS[m] || m}
                      </span>
                    ))}
                    {modulos.length > 5 && (
                      <span className="text-[10px] rounded-full border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                        +{modulos.length - 5}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    Espacio:
                    {estadoEspacio ? (
                      <span className={`rounded-full border px-1.5 py-0.5 ${estadoEspacio.className}`}>{estadoEspacio.label}</span>
                    ) : (
                      <span>sin configurar</span>
                    )}
                  </div>
                  <div className="truncate">Administrador: {espacio?.admin_local_email || espacio?.admin_local_nombre || 'sin asignar'}</div>
                  {registroPlan?.actualizado_en && (
                    <div>Plan actualizado: {new Date(registroPlan.actualizado_en).toLocaleDateString('es-ES')}</div>
                  )}
                </div>

                <div className="mt-auto flex gap-2">
                  <Button size="sm" onClick={() => entrar(emp)} className="flex-1">
                    <LogIn className="h-3.5 w-3.5" /> {abierta ? 'Abierto · ir' : 'Entrar y editar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirPlan(emp)}>
                    <Settings2 className="h-3.5 w-3.5" /> Plan
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editando} onOpenChange={(abierto) => { if (!abierto) setEditando(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Plan comercial · {editando?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {PLANES.map((p) => (
              <label
                key={p.key}
                className={`flex gap-2 rounded-lg border p-3 cursor-pointer ${planKey === p.key ? 'border-primary bg-primary/5' : ''}`}
              >
                <input
                  type="radio"
                  name="plan"
                  checked={planKey === p.key}
                  onChange={() => setPlanKey(p.key)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardarPlan} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}