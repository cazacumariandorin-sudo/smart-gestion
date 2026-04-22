import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { useTabState } from '@/hooks/useTabState';
import { Plus, Receipt, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUserRole } from '@/lib/useUserRole';
import NotaGastosCard from '@/components/gastos/NotaGastosCard';
import PageHeader from '@/components/layout/PageHeader';

export default function GastosOperarios() {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, user } = useUserRole();
  const canSeeAll = isAdmin || isJefeObra;

  const [search, setSearch] = useState('');
  const [operarioFilter, setOperarioFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [newNotaOpen, setNewNotaOpen] = useState(false);
  const [newNotaForm, setNewNotaForm] = useState({ operario_id: '', operario_name: '', titulo: '', fecha_inicio: new Date().toISOString().split('T')[0], notas: '' });

  // Read operario param from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const opId = params.get('operario');
    if (opId) setOperarioFilter(opId);
  }, []);

  const { data: notas = [], isLoading: notasLoading } = useQuery({
    queryKey: ['notas_gastos'],
    queryFn: () => base44.entities.NotaGastos.list('-created_date', 200)
  });
  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos_operarios'],
    queryFn: () => base44.entities.GastoOperario.list('-date', 500)
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200)
  });

  const myOperario = !canSeeAll && user ? operarios.find(o => o.email === user.email) : null;

  const createNotaM = useOptimisticMutation(
    d => base44.entities.NotaGastos.create(d),
    'notas_gastos',
    (prev, newNota) => [...prev, { ...newNota, id: `temp_${Date.now()}` }],
    () => setNewNotaOpen(false)
  );

  const openNewNota = () => {
    const preFilled = myOperario
      ? { operario_id: myOperario.id, operario_name: myOperario.name, titulo: '', fecha_inicio: new Date().toISOString().split('T')[0], notas: '' }
      : { operario_id: '', operario_name: '', titulo: '', fecha_inicio: new Date().toISOString().split('T')[0], notas: '' };
    setNewNotaForm(preFilled);
    setNewNotaOpen(true);
  };

  const handleOpChange = (id) => {
    const op = operarios.find(o => o.id === id);
    setNewNotaForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const handleCreateNota = () => {
    createNotaM.mutate({ ...newNotaForm, estado: 'abierta', total: 0 });
  };

  // Attach gastos to notas
  const notasWithGastos = useMemo(() => {
    return notas.map(n => ({
      ...n,
      gastos: gastos.filter(g => g.nota_id === n.id),
    }));
  }, [notas, gastos]);

  // Filter
  const filtered = useMemo(() => notasWithGastos.filter(n => {
    const q = search.toLowerCase();
    const matchQ = !search || n.operario_name?.toLowerCase().includes(q) || n.titulo?.toLowerCase().includes(q);
    const matchOp = operarioFilter === 'all' || n.operario_id === operarioFilter;
    const matchEstado = estadoFilter === 'all' || n.estado === estadoFilter;
    return matchQ && matchOp && matchEstado;
  }), [notasWithGastos, search, operarioFilter, estadoFilter]);

  const totalGeneral = filtered.reduce((s, n) => s + (n.total || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Gastos Operarios"
        subtitle={`${filtered.length} notas · ${totalGeneral.toFixed(2)} € total`}
        backTo="/operarios"
        actions={
          <Button onClick={openNewNota} className="gap-2 h-9">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva Nota</span>
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar nota u operario..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canSeeAll && (
          <MobileSelect value={operarioFilter} onValueChange={setOperarioFilter} placeholder="Operario" triggerClassName="w-full sm:w-48">
            <MobileSelectItem value="all">Todos los operarios</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        )}
        <MobileSelect value={estadoFilter} onValueChange={setEstadoFilter} placeholder="Estado" triggerClassName="w-full sm:w-36">
          <MobileSelectItem value="all">Todas</MobileSelectItem>
          <MobileSelectItem value="abierta">Abiertas</MobileSelectItem>
          <MobileSelectItem value="cerrada">Cerradas</MobileSelectItem>
        </MobileSelect>
      </div>

      {/* Notes list */}
      {notasLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay notas de gastos</p>
          <Button variant="outline" size="sm" onClick={openNewNota} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Crear primera nota
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(nota => (
            <NotaGastosCard
              key={nota.id}
              nota={nota}
              gastos={nota.gastos}
              operarios={operarios}
              canSeeAll={canSeeAll}
              myOperario={myOperario}
              user={user}
            />
          ))}
        </div>
      )}

      {/* New nota dialog */}
      <Dialog open={newNotaOpen} onOpenChange={setNewNotaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Nueva Nota de Gastos</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              {canSeeAll ? (
                <MobileSelect value={newNotaForm.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                  {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                </MobileSelect>
              ) : (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {myOperario ? myOperario.name : user?.full_name || 'Usuario actual'}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título / Referencia</Label>
              <Input
                value={newNotaForm.titulo}
                onChange={e => setNewNotaForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Viaje Barcelona, Semana del 15..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha inicio *</Label>
              <Input type="date" value={newNotaForm.fecha_inicio} onChange={e => setNewNotaForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Input value={newNotaForm.notas} onChange={e => setNewNotaForm(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewNotaOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateNota}
              disabled={!newNotaForm.operario_id || !newNotaForm.fecha_inicio || createNotaM.isPending}
              className="gap-2"
            >
              <FileText className="w-4 h-4" /> Crear Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}