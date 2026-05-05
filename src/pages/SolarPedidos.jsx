import { Sun, Users, Zap, Package, FileCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SolarClientes from './solar/SolarClientes';
import SolarObras from './solar/SolarObras';
import SolarMateriales from './solar/SolarMateriales';
import SolarLegalizacion from './solar/SolarLegalizacion';

export default function SolarPedidos() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center shadow-md">
          <Sun className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Solar</h1>
          <p className="text-sm text-muted-foreground">Gestión de proyectos de energía solar</p>
        </div>
      </div>

      <Tabs defaultValue="obras">
        <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="obras" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Obras
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="materiales" className="gap-1.5">
            <Package className="w-3.5 h-3.5" /> Materiales
          </TabsTrigger>
          <TabsTrigger value="legalizacion" className="gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Legalización
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obras">
          <SolarObras />
        </TabsContent>
        <TabsContent value="clientes">
          <SolarClientes />
        </TabsContent>
        <TabsContent value="materiales">
          <SolarMateriales />
        </TabsContent>
        <TabsContent value="legalizacion">
          <SolarLegalizacion />
        </TabsContent>
      </Tabs>
    </div>
  );
}