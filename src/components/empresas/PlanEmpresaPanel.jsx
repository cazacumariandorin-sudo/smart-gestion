import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { PLANES, MODULO_LABELS, getPlan } from '@/lib/planes';
import { cargarPlanActivo } from '@/lib/planActivo';
import { Check, Loader2, Layers, ShieldCheck, Star } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Panel del plan comercial: asigna a la empresa principal el plan contratado
 * y refresca al instante qué módulos ve la plantilla.
 */
export default function PlanEmpresaPanel() {
  const { isAdmin, user } = useUserRole();
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('-created_date', 100),
  });
  const { data: registros = [] } = useQuery({
    queryKey: ['planes-empresa'],
    queryFn: () => base44.entities.PlanEmpresa.list('-created_date', 200),
  });

  const principal = empresas.find((e) => e.es_principal) || null;
  const registro = principal ? registros.find((r) => r.empresa_id === principal.id) : null;
  const planKey = registro?.plan || 'completo';
  const plan = getPlan(planKey);

  const aplicar = async (nuevoPlan) => {
    if (!principal || !isAdmin || nuevoPlan === planKey || guardando) return;
    setGuardando(nuevoPlan);
    try {
      const datos = {
        empresa_id: principal.id,
        empresa_nombre: principal.nombre || '',
        plan: nuevoPlan,
        activo: true,
        actualizado_por: user?.email || '',
        actualizado_en: new Date().toISOString(),
      };
      if (registro) await base44.entities.PlanEmpresa.update(registro.id, datos);
      else await base44.entities.PlanEmpresa.create(datos);
      await cargarPlanActivo({ forzar: true });
      qc.invalidateQueries({ queryKey: ['planes-empresa'] });
      toast({ title: `Plan: ${getPlan(nuevoPlan).label}`, description: 'El menú ya se ajusta al nuevo plan.' });
    } catch (e) {
      toast({ title: 'No se pudo cambiar el plan', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(null);
    }
  };

  if (!principal) {
    return (
      <div className="border rounded-lg p-4 bg-card text-sm text-muted-foreground">
        Marca una empresa como principal para poder asignarle un plan comercial.
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold leading-tight flex items-center gap-1">
              Plan comercial <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-xs text-muted-foreground">{principal.nombre} · empresa principal</div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          Activo: {plan.label}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PLANES.map((opcion) => {
          const seleccionado = opcion.key === planKey;
          return (
            <button
              key={opcion.key}
              type="button"
              disabled={!isAdmin || !!guardando}
              onClick={() => aplicar(opcion.key)}
              className={[
                'text-left rounded-lg border p-3 transition-colors min-h-[44px]',
                seleccionado ? 'border-primary bg-primary/5' : isAdmin ? 'hover:bg-accent' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{opcion.label}</span>
                {guardando === opcion.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : seleccionado ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{opcion.descripcion}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {opcion.modulos ? (
                  opcion.modulos.map((m) => (
                    <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {MODULO_LABELS[m] || m}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Todos los módulos
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {isAdmin
          ? 'El plan decide qué módulos ve la plantilla: un módulo oculto tampoco se abre por URL. No cambia los permisos por rol ni el acceso a los datos, y los administradores siguen viendo todo para poder cambiar el plan.'
          : 'Solo administración puede cambiar el plan. El plan decide qué módulos ve la plantilla; los permisos por rol y el acceso a los datos no cambian.'}
      </p>
      {registro?.actualizado_en && (
        <p className="text-[11px] text-muted-foreground">
          Último cambio: {new Date(registro.actualizado_en).toLocaleString('es-ES')}
          {registro.actualizado_por ? ` · ${registro.actualizado_por}` : ''}
        </p>
      )}
    </div>
  );
}