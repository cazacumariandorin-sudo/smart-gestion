import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import EspacioEmpresaDialog from './EspacioEmpresaDialog';
import { ESTADOS_ESPACIO } from '@/lib/multiempresa';
import { getPlan } from '@/lib/planes';
import { Building2, ExternalLink, Network, Settings2, ShieldCheck, Star, UserCheck } from 'lucide-react';

/**
 * Espacios de empresa: cada empresa trabaja en su propio espacio Base44.
 * Aquí se registra quién lo administra y en qué punto está su aprovisionamiento.
 */
export default function EspaciosEmpresaPanel() {
  const { isAdmin, isGerencia } = useUserRole();
  const [dialog, setDialog] = useState(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('-created_date', 100),
  });
  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-empresa'],
    queryFn: () => base44.entities.EspacioEmpresa.list('-created_date', 200),
  });

  if (!isGerencia) return null;

  const espacioDe = (empresaId) => espacios.find((e) => e.empresa_id === empresaId) || null;
  const activos = espacios.filter((e) => e.estado === 'activo').length;

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Espacios de empresa</div>
            <div className="text-xs text-muted-foreground">
              Cada empresa, SIMANTEC incluida, trabaja en su propio espacio Base44 con sus usuarios y sus datos.
            </div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
          {activos} de {empresas.length} activos
        </span>
      </div>

      {empresas.length === 0 ? (
        <div className="text-sm text-muted-foreground">Registra antes las empresas para poder asignarles un espacio.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((empresa) => {
            const espacio = espacioDe(empresa.id);
            const estado = espacio ? ESTADOS_ESPACIO[espacio.estado] || ESTADOS_ESPACIO.pendiente_configuracion : null;
            const pasos = espacio?.checklist || [];
            const hechos = pasos.filter((p) => p.hecho).length;
            return (
              <div key={empresa.id} className="border rounded-lg p-3 bg-background flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {empresa.logo_url
                      ? <img src={empresa.logo_url} alt={empresa.nombre} className="h-8 w-8 rounded-md object-contain bg-white border shrink-0" />
                      : <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>}
                    <div className="min-w-0">
                      <div className="font-medium leading-tight truncate">{empresa.nombre}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{empresa.cif}</div>
                    </div>
                  </div>
                  {empresa.es_principal && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                </div>

                {espacio ? (
                  <>
                    <span className={`text-[11px] px-2 py-0.5 rounded border w-fit ${estado.className}`}>{estado.label}</span>
                    {espacio.admin_local_email && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                        <UserCheck className="h-3 w-3 shrink-0" /> {espacio.admin_local_nombre || espacio.admin_local_email}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      Plan: {getPlan(espacio.plan).label} · Pasos {hechos}/{pasos.length || 5}
                    </div>
                    {espacio.url_espacio && (
                      <a href={espacio.url_espacio} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Abrir espacio
                      </a>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground">Sin espacio registrado.</div>
                )}

                <div className="mt-auto pt-1">
                  {isAdmin ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setDialog({ empresa, espacio })}>
                      <Settings2 className="h-3.5 w-3.5" /> {espacio ? 'Configurar espacio' : 'Registrar espacio'}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Solo el propietario configura espacios
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        El aislamiento lo garantiza el propio espacio: los usuarios de una empresa no pueden consultar los datos de otra. El propietario es el único con visión sobre todos los espacios.
      </p>

      {dialog && (
        <EspacioEmpresaDialog
          empresa={dialog.empresa}
          espacio={dialog.espacio}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}