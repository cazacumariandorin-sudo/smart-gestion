import { Navigate } from 'react-router-dom';
import { Building2, Megaphone, Inbox } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmpresasConsolaTab from '@/components/consola/EmpresasConsolaTab';
import ComercialConsolaTab from '@/components/consola/ComercialConsolaTab';
import SolicitudesComercialesTab from '@/components/consola/SolicitudesComercialesTab';

/** Consola central del propietario global: empresas, contenido comercial y solicitudes. */
export default function ConsolaPropietario() {
  const { user } = useAuth();
  const esPropietario = user?.es_propietario_global === true || user?.role === 'propietario';

  if (!esPropietario) return <Navigate to="/" replace />;

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Consola del propietario"
        subtitle="Empresas, planes, contenido comercial y solicitudes de clientes"
      />

      <Tabs defaultValue="empresas" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex">
          <TabsTrigger value="empresas" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Empresas</TabsTrigger>
          <TabsTrigger value="comercial" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Comercial</TabsTrigger>
          <TabsTrigger value="solicitudes" className="gap-1.5"><Inbox className="h-3.5 w-3.5" /> Solicitudes</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas"><EmpresasConsolaTab /></TabsContent>
        <TabsContent value="comercial"><ComercialConsolaTab /></TabsContent>
        <TabsContent value="solicitudes"><SolicitudesComercialesTab /></TabsContent>
      </Tabs>
    </div>
  );
}