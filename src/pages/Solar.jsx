import { Sun, Users, Zap, Package, FileCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { useTabState } from '@/hooks/useTabState';
import SolarClientes from './solar/SolarClientes';
import SolarObras from './solar/SolarObras';
import SolarMateriales from './solar/SolarMateriales';
import SolarLegalizacion from './solar/SolarLegalizacion';

export default function Solar() {
  const [tab, setTab] = useTabState('solar', 'obras');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Proyectos Solares"
        subtitle="Gestión integrada de energía solar"
        hideBack={true}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="obras" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Obras Solar
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
    </div>
  );
}