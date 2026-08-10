import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';
import CicloCard from '@/components/gastos/CicloCard';
import BannerCicloActivo from '@/components/gastos/BannerCicloActivo';
import { Loader2 } from 'lucide-react';

/**
 * Panel de ciclos mensuales de gastos (modelo 26→25 / NotaMensualGasto).
 *
 * - Gerencia / admin: ven todos los ciclos de todos los operarios.
 * - Otros roles (técnicos, operarios): ven solo los ciclos cuyo operario_email
 *   coincide con el correo del usuario actual (gracias al RLS de la entidad).
 * - El botón "Exportar a contabilidad" solo se ofrece a gerencia/admin y para
 *   ciclos con registros.
 */
export default function CiclosMensualesPanel() {
  const { user } = useAuth();
  const { isAdmin, isGerencia } = useUserRole();
  const qc = useQueryClient();
  const canExport = isAdmin || isGerencia;

  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['nota_mensual_gasto'],
    queryFn: () => base44.entities.NotaMensualGasto.list('-ciclo_mes', 500),
  });

  // Agrupar por ciclo_mes (descendente por fecha)
  const grupos = {};
  for (const c of ciclos) {
    const key = c.ciclo_mes || 'sin_ciclo';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }
  const cicloKeys = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  const onExported = () => {
    qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
  };

  return (
    <div className="space-y-4">
      <BannerCicloActivo />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando ciclos…
        </div>
      ) : cicloKeys.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl text-sm text-muted-foreground">
          Todavía no hay ciclos mensuales de gastos abiertos.
        </div>
      ) : (
        <div className="space-y-5">
          {cicloKeys.map(key => (
            <div key={key}>
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-2 mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Ciclo <span className="font-mono">{key}</span>
                </h3>
                <span className="text-xs text-muted-foreground">
                  {grupos[key].length} nota{grupos[key].length === 1 ? '' : 's'}
                  {' · '}
                  {grupos[key].reduce((s, n) => s + (n.total_importe || 0), 0).toFixed(2)} €
                </span>
              </div>
              <div className="space-y-2">
                {grupos[key].map(nota => (
                  <CicloCard key={nota.id} nota={nota} canExport={canExport} onExported={onExported} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}