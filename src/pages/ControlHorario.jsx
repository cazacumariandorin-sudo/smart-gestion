import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FichajesTab from '@/components/horario/FichajesTab';
import InformesTab from '@/components/horario/InformesTab';
import AlarmasTab from '@/components/horario/AlarmasTab';
import ApuntesTab from '@/components/horario/ApuntesTab';
import { Clock, BarChart3, Bell, ClipboardList } from 'lucide-react';
import { useAlarmas } from '@/hooks/useAlarmas';

export default function ControlHorario() {
  const { data: alarmas = [] } = useQuery({
    queryKey: ['alarmas'],
    queryFn: () => base44.entities.AlarmaHorario.list('hora', 100),
  });

  // Activate alarm listener globally
  useAlarmas(alarmas);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="w-7 h-7 text-primary" /> Control Horario
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Fichajes, informes y alarmas de operarios</p>
      </div>

      <Tabs defaultValue="fichajes">
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto w-full sm:w-auto sm:flex-nowrap">
          <TabsTrigger value="fichajes" className="flex items-center gap-2 flex-1 sm:flex-none">
            <Clock className="w-4 h-4" /> Fichajes
          </TabsTrigger>
          <TabsTrigger value="informes" className="flex items-center gap-2 flex-1 sm:flex-none">
            <BarChart3 className="w-4 h-4" /> Informes
          </TabsTrigger>
          <TabsTrigger value="apuntes" className="flex items-center gap-2 flex-1 sm:flex-none">
            <ClipboardList className="w-4 h-4" /> Apuntes
          </TabsTrigger>
          <TabsTrigger value="alarmas" className="flex items-center gap-2 flex-1 sm:flex-none">
            <Bell className="w-4 h-4" /> Alarmas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fichajes"><FichajesTab /></TabsContent>
        <TabsContent value="informes"><InformesTab /></TabsContent>
        <TabsContent value="apuntes"><ApuntesTab /></TabsContent>
        <TabsContent value="alarmas"><AlarmasTab /></TabsContent>
      </Tabs>
    </div>
  );
}