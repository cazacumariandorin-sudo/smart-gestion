import { useState } from 'react';
import { Sun } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Orders from './Orders';
import Obras from './Obras';

// Solar module - mirrors Orders and Obras with Solar branding
export default function SolarPedidos() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center">
          <Sun className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Solar</h1>
          <p className="text-sm text-muted-foreground">Gestión de proyectos solares</p>
        </div>
      </div>

      <Tabs defaultValue="pedidos">
        <TabsList className="mb-4">
          <TabsTrigger value="pedidos">☀️ Pedidos Solar</TabsTrigger>
          <TabsTrigger value="obras">🏗️ Obras Solar</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos">
          <Orders />
        </TabsContent>
        <TabsContent value="obras">
          <Obras />
        </TabsContent>
      </Tabs>
    </div>
  );
}