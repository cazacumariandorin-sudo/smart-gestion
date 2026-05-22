import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Route, Bell, AlertTriangle, CheckCircle2, Clock, MapPin, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const URGENCIA_COLORS = {
  baja: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
};

const TIPO_ALERTA_LABELS = {
  itv_proxima: 'ITV próxima',
  itv_caducada: 'ITV caducada',
  aceite_km: 'Cambio aceite (km)',
  aceite_fecha: 'Cambio aceite (fecha)',
  neumaticos_km: 'Neumáticos',
  filtros_km: 'Filtros (km)',
  filtros_fecha: 'Filtros (fecha)',
  ac_revision: 'Revisión A/C',
  velocidad_exceso: 'Exceso velocidad',
  mantenimiento_general: 'Mantenimiento',
};

export default function Flota() {
  const queryClient = useQueryClient();

  const { data: vehiculos = [] } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: () => base44.entities.Vehiculo.list('-created_date', 100),
  });

  const { data: viajes = [] } = useQuery({
    queryKey: ['viajes'],
    queryFn: () => base44.entities.ViajeVehiculo.list('-fecha', 100),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-vehiculo'],
    queryFn: () => base44.entities.AlertaVehiculo.list('-fecha', 100),
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: (id) => base44.entities.AlertaVehiculo.update(id, { resuelta: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas-vehiculo'] }),
  });

  const alertasPendientes = alertas.filter(a => !a.resuelta);
  const alertasResueltas = alertas.filter(a => a.resuelta);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Car className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Gestión de Flota</h1>
        {alertasPendientes.length > 0 && (
          <Badge className="bg-red-500 text-white">{alertasPendientes.length} alertas</Badge>
        )}
      </div>

      <Tabs defaultValue="vehiculos">
        <TabsList className="mb-4">
          <TabsTrigger value="vehiculos">
            <Car className="w-4 h-4 mr-1.5" /> Vehículos ({vehiculos.length})
          </TabsTrigger>
          <TabsTrigger value="viajes">
            <Route className="w-4 h-4 mr-1.5" /> Viajes ({viajes.length})
          </TabsTrigger>
          <TabsTrigger value="alertas">
            <Bell className="w-4 h-4 mr-1.5" /> Alertas
            {alertasPendientes.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">{alertasPendientes.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* TAB VEHÍCULOS */}
        <TabsContent value="vehiculos">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehiculos.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No hay vehículos registrados</p>
              </div>
            )}
            {vehiculos.map(v => {
              const alertasV = alertasPendientes.filter(a => a.vehiculo_id === v.id);
              return (
                <Card key={v.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{v.matricula}</CardTitle>
                        <p className="text-sm text-muted-foreground">{v.modelo}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {alertasV.length > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />{alertasV.length}
                          </Badge>
                        )}
                        <div className={cn('w-2.5 h-2.5 rounded-full', v.estado_motor === 'en_marcha' ? 'bg-green-500' : 'bg-slate-300')} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    {v.asignado_a && <p className="text-muted-foreground">👤 {v.asignado_a}</p>}
                    {v.km_actuales && <p className="text-muted-foreground">🛣 {v.km_actuales.toLocaleString()} km</p>}
                    {v.itv_fecha && (
                      <p className={cn('text-xs', new Date(v.itv_fecha) < new Date() ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                        ITV: {format(new Date(v.itv_fecha), 'dd/MM/yyyy')}
                      </p>
                    )}
                    {v.proyecto_actual_nombre && (
                      <p className="text-xs text-primary font-medium">📍 {v.proyecto_actual_nombre}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB VIAJES */}
        <TabsContent value="viajes">
          <div className="space-y-2">
            {viajes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Route className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No hay viajes registrados</p>
              </div>
            )}
            {viajes.map(v => (
              <Card key={v.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Car className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{v.vehiculo_matricula}</p>
                      <p className="text-xs text-muted-foreground">{v.operario_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {v.fecha && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(v.fecha), 'dd MMM yyyy', { locale: es })}</span>}
                    {v.distancia_km && <span className="flex items-center gap-1"><Route className="w-3 h-3" />{v.distancia_km} km</span>}
                    {v.coste_combustible_estimado && <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{v.coste_combustible_estimado.toFixed(2)} €</span>}
                  </div>
                </div>
                {(v.inicio_direccion || v.fin_direccion) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0 text-primary" />
                    <span>{v.inicio_direccion}</span>
                    {v.fin_direccion && <><span>→</span><span>{v.fin_direccion}</span></>}
                  </div>
                )}
                {v.proyecto_nombre && (
                  <p className="mt-1 text-xs text-primary font-medium pl-5">📁 {v.proyecto_nombre}</p>
                )}
                {v.validado && <Badge className="mt-2 bg-green-100 text-green-700 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Validado</Badge>}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB ALERTAS */}
        <TabsContent value="alertas">
          {alertasPendientes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pendientes</h3>
              <div className="space-y-2">
                {alertasPendientes.map(a => (
                  <Card key={a.id} className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={cn('w-5 h-5', a.urgencia === 'critica' || a.urgencia === 'alta' ? 'text-red-500' : 'text-yellow-500')} />
                        <div>
                          <p className="font-medium text-sm">{TIPO_ALERTA_LABELS[a.tipo] || a.tipo}</p>
                          <p className="text-xs text-muted-foreground">{a.vehiculo_matricula} {a.vehiculo_modelo && `— ${a.vehiculo_modelo}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', URGENCIA_COLORS[a.urgencia])}>{a.urgencia}</Badge>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolverAlertaMutation.mutate(a.id)}>
                          Resolver
                        </Button>
                      </div>
                    </div>
                    {a.descripcion && <p className="text-xs text-muted-foreground mt-1.5 pl-8">{a.descripcion}</p>}
                  </Card>
                ))}
              </div>
            </div>
          )}
          {alertasResueltas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resueltas</h3>
              <div className="space-y-2">
                {alertasResueltas.map(a => (
                  <Card key={a.id} className="p-3 opacity-60">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-sm">{TIPO_ALERTA_LABELS[a.tipo] || a.tipo}</p>
                        <p className="text-xs text-muted-foreground">{a.vehiculo_matricula}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {alertas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No hay alertas</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}