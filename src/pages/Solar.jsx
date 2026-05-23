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
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'obras',       label: 'Obras Solar',   icon: Zap,       color: 'bg-amber-500 hover:bg-amber-600 border-amber-600 shadow-amber-200' },
              { value: 'clientes',    label: 'Clientes',      icon: Users,     color: 'bg-teal-500 hover:bg-teal-600 border-teal-600 shadow-teal-200' },
              { value: 'materiales',  label: 'Materiales',    icon: Package,   color: 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-blue-200' },
              { value: 'legalizacion',label: 'Legalización',  icon: FileCheck, color: 'bg-purple-500 hover:bg-purple-600 border-purple-600 shadow-purple-200' },
            ].map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm text-white shadow-md',
                  'transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95',
                  color,
                  tab === value ? 'ring-2 ring-offset-2 ring-current scale-105 shadow-lg' : 'opacity-80',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {/* Hidden TabsList to keep Radix state working */}
          <TabsList className="hidden">
            <TabsTrigger value="obras" />
            <TabsTrigger value="clientes" />
            <TabsTrigger value="materiales" />
            <TabsTrigger value="legalizacion" />
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