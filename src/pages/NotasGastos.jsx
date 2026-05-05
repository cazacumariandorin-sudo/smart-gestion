import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import CrearNotaGastos from '@/components/gastos/CrearNotaGastos';
import ListaNotasGastos from '@/components/gastos/ListaNotasGastos';

export default function NotasGastos() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('lista');

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas_gastos'],
    queryFn: () => base44.entities.NotaGastos.list('-created_date', 500),
  });

  const filtered = notas.filter(n => {
    const q = search.toLowerCase();
    return !search || n.titulo?.toLowerCase().includes(q) || n.proveedor?.toLowerCase().includes(q) || n.concepto?.includes(q);
  });

  const handleNotaCreated = () => {
    qc.invalidateQueries({ queryKey: ['notas_gastos'] });
    setActiveTab('lista');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Notas de Gastos"
        subtitle={`${notas.length} notas · Total: ${notas.reduce((s, n) => s + (n.importe || 0), 0).toFixed(2)} €`}
        actions={<Button onClick={() => setActiveTab('crear')} className="gap-2"><Plus className="w-4 h-4" /> Nueva Nota</Button>}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="lista">📋 Mis notas</TabsTrigger>
            <TabsTrigger value="crear">➕ Crear nota</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-0">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por título, proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <ListaNotasGastos notas={filtered} isLoading={isLoading} onRefresh={() => qc.invalidateQueries({ queryKey: ['notas_gastos'] })} />
          </TabsContent>

          <TabsContent value="crear" className="mt-0">
            <CrearNotaGastos onSuccess={handleNotaCreated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}