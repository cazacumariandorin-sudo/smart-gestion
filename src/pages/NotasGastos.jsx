import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import PageHeader from '@/components/layout/PageHeader';
import NotaGastosCard from '@/components/gastos/NotaGastosCard';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

export default function NotasGastos() {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, user } = useUserRole();
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');
  const [estFilter, setEstFilter] = useState('all');
  const [newOpen, setNewOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [newForm, setNewForm] = useState({ operario_id: '', operario_name: '', titulo: '', fecha_inicio: today, fecha_cierre: '', notas: '', estado: 'abierta' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const opId = params.get('operario');
      if (opId) setOpFilter(opId);
    }
  }, []);

  const { data: notas = [], isLoading: notasLoading } = useQuery({
    queryKey: ['notas_gastos'],
    queryFn: () => base44.entities.NotaGastos.list('-created_date', 200).then(r => r || [])
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos_operarios'],
    queryFn: () => base44.entities.GastoOperario.list('-date', 500).then(r => r || [])
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200).then(r => r || [])
  });

  const canSeeAll = isAdmin || isJefeObra;
  const myOp = canSeeAll ? null : operarios.find(o => o.email === user?.email);

  const createM = useMutation({
    mutationFn: d => base44.entities.NotaGastos.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
      setNewOpen(false);
      setNewForm({ operario_id: '', operario_name: '', titulo: '', fecha_inicio: today, notas: '' });
      toast.success('Nota de gastos creada');
    },
    onError: () => toast.error('Error al crear la nota'),
  });

  const notasWithGastos = notas.map(n => ({ ...n, gastos: gastos.filter(g => g.nota_id === n.id) }));

  const filtered = notasWithGastos.filter(n => {
    const q = search.toLowerCase();
    const matchSearch = !search || n.operario_name?.toLowerCase().includes(q) || n.titulo?.toLowerCase().includes(q);
    const matchOp = opFilter === 'all' || n.operario_id === opFilter;
    const matchEst = estFilter === 'all' || n.estado === estFilter;
    return matchSearch && matchOp && matchEst;
  });

  const totalGeneral = filtered.reduce((s, n) => s + (n.total || 0), 0);

  const handleOpenNew = () => {
    const opId = canSeeAll ? '' : (myOp?.id || '');
    setNewForm({
      operario_id: opId,
      operario_name: canSeeAll ? '' : (myOp?.name || ''),
      titulo: '',
      fecha_inicio: today,
      fecha_cierre: '',
      notas: '',
      estado: 'abierta'
    });
    setNewOpen(true);
  };

  const handleOpChange = id => {
    const op = operarios.find(o => o.id === id);
    setNewForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const handleCreate = () => {
    if (!newForm.operario_id || !newForm.fecha_inicio) {
      toast.error('Debe seleccionar operario y fecha inicio');
      return;
    }
    createM.mutate({ ...newForm, total: 0 });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Notas de Gastos"
        subtitle={`${filtered.length} notas · ${totalGeneral.toFixed(2)} € total`}
        backTo="/operarios"
        actions={<Button onClick={handleOpenNew} className="gap-2 h-9"><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva Nota</span></Button>}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar nota u operario..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {canSeeAll && (
            <MobileSelect value={opFilter} onValueChange={setOpFilter} placeholder="Operario" triggerClassName="w-full sm:w-48">
              <MobileSelectItem value="all">Todos los operarios</MobileSelectItem>
              {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
            </MobileSelect>
          )}
          <MobileSelect value={estFilter} onValueChange={setEstFilter} placeholder="Estado" triggerClassName="w-full sm:w-36">
            <MobileSelectItem value="all">Todas</MobileSelectItem>
            <MobileSelectItem value="abierta">Abiertas</MobileSelectItem>
            <MobileSelectItem value="cerrada">Cerradas</MobileSelectItem>
          </MobileSelect>
        </div>

        {notasLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>}

        {!notasLoading && filtered.length === 0 && (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No hay notas de gastos</p>
            <Button variant="outline" size="sm" onClick={handleOpenNew} className="gap-2"><Plus className="w-3.5 h-3.5" /> Crear primera nota</Button>
          </div>
        )}

        {!notasLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(nota => (
              <NotaGastosCard key={nota.id} nota={nota} gastos={nota.gastos} operarios={operarios} canSeeAll={canSeeAll} myOperario={myOp} user={user} />
            ))}
          </div>
        )}

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Nueva Nota de Gastos</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Operario *</Label>
                {canSeeAll ? (
                  <MobileSelect value={newForm.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                    {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                  </MobileSelect>
                ) : (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">{myOp ? myOp.name : user?.full_name || 'Usuario actual'}</div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Título / Referencia</Label>
                <Input value={newForm.titulo} onChange={e => setNewForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Viaje Barcelona, Semana del 15..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha inicio *</Label>
                <Input type="date" value={newForm.fecha_inicio} onChange={e => setNewForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha cierre (opcional)</Label>
                <Input type="date" value={newForm.fecha_cierre} onChange={e => setNewForm(p => ({ ...p, fecha_cierre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observaciones</Label>
                <Input value={newForm.notas} onChange={e => setNewForm(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newForm.operario_id || !newForm.fecha_inicio || createM.isPending} className="gap-2"><FileText className="w-4 h-4" /> Crear Nota</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}