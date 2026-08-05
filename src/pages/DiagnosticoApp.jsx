import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useUserRole } from '@/lib/useUserRole';

import ListaSesionesDiagnostico from '@/components/diagnostico/ListaSesionesDiagnostico';
import DetalleSesionDiagnostico from '@/components/diagnostico/DetalleSesionDiagnostico';
import GestionAccesosDiagnostico from '@/components/diagnostico/GestionAccesosDiagnostico';
import VigilanciaPanel from '@/components/diagnostico/VigilanciaPanel';
import { base44 } from '@/api/base44Client';
import { Bug, Users, Activity, ShieldCheck, Eye } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/layout/PageHeader';
import { Navigate } from 'react-router-dom';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('getDiagnosticoData', { action, ...payload }).then(r => r.data);

export default function DiagnosticoApp() {
  const { user, isLoading } = useUserRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('sesiones');
  const [sesionSel, setSesionSel] = useState(null);

  // Verificar acceso (gerencia/admin directo, IT a través de DiagnosticoAcceso)
  const { data: checkAcceso, isLoading: loadingAcceso, isError: forbidden } = useQuery({
    queryKey: ['diag-access-check', user?.id],
    queryFn: () => LLAMAR('check_access'),
    enabled: !!user,
    retry: false,
    staleTime: 60_000
  });

  const { data: sesionesRes, isLoading: loadingSesiones, refetch } = useQuery({
    queryKey: ['diag-sesiones'],
    queryFn: () => LLAMAR('list_sesiones', { limit: 200 }),
    enabled: !!checkAcceso?.autorizado && tab === 'sesiones'
  });

  const { data: accesosRes, isLoading: loadingAccesos } = useQuery({
    queryKey: ['diag-accesos'],
    queryFn: () => LLAMAR('list_accesos'),
    enabled: !!checkAcceso?.autorizado && tab === 'accesos'
  });

  const actualizarSesionMutation = useMutation({
    mutationFn: (payload) => LLAMAR('update_sesion', payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['diag-sesiones'] });
      if (data?.eliminada) {
        setSesionSel(null);
        toast({ title: 'Incidente resuelto y eliminado ✓', description: 'La sesión se borró automáticamente al marcarla como resuelta.' });
      } else {
        toast({ title: 'Sesión actualizada ✓' });
      }
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Error', description: e.message })
  });

  const sesiones = sesionesRes?.sesiones || [];
  const accesos = accesosRes?.accesos || [];

  // Estadísticas rápidas (hooks antes de early returns)
  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      total: sesiones.length,
      nuevos: sesiones.filter(s => s.estado === 'nuevo').length,
      criticos: sesiones.filter(s => s.severidad === 'critico').length,
      hoy: sesiones.filter(s => (s.created_date || '').slice(0, 10) === hoy).length
    };
  }, [sesiones]);

  if (isLoading || loadingAcceso) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // Si no autorizado → fuera
  if (!checkAcceso?.autorizado || forbidden) {
    return <Navigate to="/" replace />;
  }

  const esGerencia = checkAcceso.isGerencia;

  return (
    <div className="min-h-screen pb-20">
      <PageHeader
        title="Diagnóstico de la app"
        subtitle={esGerencia
          ? 'Acceso Gerencia — Todas las herramientas'
          : `Acceso IT autorizado (${checkAcceso.rol_asignado}) — Solo lectura`}
      />

      <div className="px-4 py-3 space-y-4">
        {/* Banner de rol */}
        <div className={`rounded-md p-2 text-xs flex items-center gap-2 ${esGerencia ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          <ShieldCheck className="w-4 h-4" />
          {esGerencia
            ? 'Tienes acceso completo de Gerencia — puedes ver sesiones, gestionar accesos IT y resolver incidencias.'
            : 'Tienes acceso restringido de soporte IT — puedes consultar incidentes y dejar comentarios. La gestión de accesos corresponde a Gerencia.'}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="border-slate-200"><CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-slate-700">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </CardContent></Card>
          <Card className="border-amber-200"><CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-amber-600">{stats.nuevos}</div>
            <div className="text-[10px] text-muted-foreground">Nuevos</div>
          </CardContent></Card>
          <Card className="border-red-200"><CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-red-600">{stats.criticos}</div>
            <div className="text-[10px] text-muted-foreground">Críticos</div>
          </CardContent></Card>
          <Card className="border-emerald-200"><CardContent className="p-2 text-center">
            <div className="text-lg font-bold text-emerald-600">{stats.hoy}</div>
            <div className="text-[10px] text-muted-foreground">Hoy</div>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={`w-full grid ${esGerencia ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="sesiones" className="text-xs">
              <Bug className="w-3.5 h-3.5 mr-1.5" /> Incidentes
            </TabsTrigger>
            {esGerencia && (
              <TabsTrigger value="accesos" className="text-xs">
                <Users className="w-3.5 h-3.5 mr-1.5" /> Accesos IT
              </TabsTrigger>
            )}
            {esGerencia && (
              <TabsTrigger value="vigilancia" className="text-xs">
                <Eye className="w-3.5 h-3.5 mr-1.5" /> Vigilancia
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sesiones" className="mt-3">
            <ListaSesionesDiagnostico
              sesiones={sesiones}
              loading={loadingSesiones}
              onSelect={setSesionSel}
              selectedId={sesionSel?.id}
              onUpdate={actualizarSesionMutation.mutate}
            />
          </TabsContent>

          {esGerencia && (
            <TabsContent value="accesos" className="mt-3">
              <GestionAccesosDiagnostico accesos={accesos} loading={loadingAccesos} />
            </TabsContent>
          )}

          {esGerencia && (
            <TabsContent value="vigilancia" className="mt-3">
              <VigilanciaPanel esGerencia={esGerencia} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Detalle modal */}
      <DetalleSesionDiagnostico
        sesion={sesionSel}
        onClose={() => setSesionSel(null)}
        onUpdate={actualizarSesionMutation.mutate}
        puedeEditar={true}
        puedeArreglarIA={esGerencia}
      />

    </div>
  );
}