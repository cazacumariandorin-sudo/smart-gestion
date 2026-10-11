import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link } from 'react-router-dom';
import { Plus, Search, SpellCheck, Hash, CheckSquare, Download, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { numeroParteVisible, asignarNumerosPendientes } from '@/lib/numeroParte';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';
import { useUserRole } from '@/lib/useUserRole';
import RevisionOrtograficaDialog from '@/components/workorders/RevisionOrtograficaDialog';
import { useUrlState } from '@/lib/useUrlState';
import { descargarPartesPdf } from '@/lib/partePdf';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
export default function WorkOrders() {
  const queryClient = useQueryClient();
  const { role, isAdmin, isGerencia, isAdministracion } = useUserRole();
  const puedeRevisar = isGerencia || isAdministracion;
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const [numerando, setNumerando] = useState(false);
  const isClienteObra = role === 'cliente_obra';
   // Filtros guardados en la URL: al volver atrás desde un parte se conservan
  const [search, setSearch] = useUrlState('q', '');
  const [statusFilter, setStatusFilter] = useUrlState('estado', 'all');
  const [clientFilter, setClientFilter] = useUrlState('client', 'all');

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['workorders'] });
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.filter({}, { sort: '-created_date', limit: 200 }).then(r => r.items),
  });

  const numerarPendientes = async () => {
    setNumerando(true);
    const id = toast.loading('Asignando números a partes y clientes…');
    try {
      const r = await asignarNumerosPendientes(({ partes, clientes, pendientes }) =>
        toast.loading(`Asignados: ${partes} partes, ${clientes} clientes · quedan ${pendientes}`, { id }));
      toast.success(`Listo: ${r.partes} parte(s) y ${r.clientes} cliente(s) numerados${r.pendientes ? ` · quedan ${r.pendientes} (repite)` : ''}`, { id, duration: 7000 });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      console.error('[Numeración] backfill', err);
      toast.error(`No se pudo completar la numeración: ${err?.message || 'error'}`, { id, duration: 8000 });
    } finally {
      setNumerando(false);
    }
  };
  // ── Selección múltiple (descargar PDF / borrar / revisar ortografía) ──
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [descargando, setDescargando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [revSelAbierta, setRevSelAbierta] = useState(false);
  const puedeBorrar = isAdmin || isGerencia; // igual que los permisos de borrado de WorkOrder

  const toggleSeleccion = (id) =>
    setSeleccion((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const salirSeleccion = () => { setModoSeleccion(false); setSeleccion(new Set()); };
  const partesSeleccionados = () => orders.filter((o) => seleccion.has(o.id));

  const descargarSeleccion = async () => {
    const lista = partesSeleccionados().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!lista.length) return;
    setDescargando(true);
    try {
      await descargarPartesPdf(lista, lista.length === 1 ? undefined : `partes-${lista.length}.pdf`);
      toast.success(`PDF generado con ${lista.length} parte(s)`);
    } catch (err) {
      console.error('[Partes] PDF múltiple', err);
      toast.error('No se pudo generar el PDF. Inténtalo con menos partes.');
    } finally {
      setDescargando(false);
    }
  };

  const borrarSeleccion = async () => {
    const lista = partesSeleccionados();
    setBorrando(true);
    let ok = 0; let fallos = 0;
    for (const o of lista) {
      try { await base44.entities.WorkOrder.delete(o.id); ok++; } catch (e) { console.error('[Partes] borrar', o.id, e); fallos++; }
    }
    setBorrando(false);
    setConfirmarBorrado(false);
    await queryClient.invalidateQueries({ queryKey: ['workorders'] });
    setSeleccion(new Set());
    if (fallos) toast.error(`${ok} borrado(s) y ${fallos} con error (permisos o conexión)`);
    else { toast.success(`${ok} parte(s) borrado(s)`); setModoSeleccion(false); }
  };
  const filtered = orders.filter(order => {
    const matchesSearch = !search ||
      order.project?.toLowerCase().includes(search.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      numeroParteVisible(order).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesClient = clientFilter === 'all' || order.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Partes de Trabajo"
        subtitle={`${filtered.length} partes encontrados`}
        hideBack={true}
        actions={!isClienteObra && (
          <>
            {puedeRevisar && orders.some(o => !o.numero_parte) && (
              <Button variant="outline" className="gap-2" size="sm" disabled={numerando} onClick={numerarPendientes}>
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">{numerando ? 'Numerando…' : `Asignar números (${orders.filter(o => !o.numero_parte).length})`}</span>
              </Button>
            )}
            <Button variant={modoSeleccion ? 'default' : 'outline'} className="gap-2" size="sm"
              onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}>
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">{modoSeleccion ? 'Salir de selección' : 'Seleccionar'}</span>
            </Button>
            {puedeRevisar && orders.some(o => !o.numero_parte) && (
              <Button variant="outline" className="gap-2" size="sm" onClick={() => setRevisionAbierta(true)}>
                <SpellCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Revisión ortográfica</span>
              </Button>
            )}
            <Link to="/work-orders/new">
              <Button className="gap-2 shadow-sm" size="sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo Parte</span>
              </Button>
            </Link>
          </>
        )}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por obra, cliente o nº de parte..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="w-full sm:w-48">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => (
            <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>
          ))}
        </MobileSelect>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos</MobileSelectItem>
          <MobileSelectItem value="pendiente">Pendiente</MobileSelectItem>
          <MobileSelectItem value="en_curso">En curso</MobileSelectItem>
          <MobileSelectItem value="completado">Completado</MobileSelectItem>
        </MobileSelect>
      </div>
      {modoSeleccion && (
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{seleccion.size} seleccionado(s)</span>
          <Button variant="outline" size="sm" onClick={() => setSeleccion(new Set(filtered.map((o) => o.id)))}>Todos ({filtered.length})</Button>
          <Button variant="outline" size="sm" disabled={!seleccion.size} onClick={() => setSeleccion(new Set())}>Ninguno</Button>
          <div className="flex-1" />
          <Button size="sm" className="gap-1.5" disabled={!seleccion.size || descargando} onClick={descargarSeleccion}>
            <Download className="w-4 h-4" /> {descargando ? 'Generando…' : 'Descargar PDF'}
          </Button>
          {puedeRevisar && (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!seleccion.size} onClick={() => setRevSelAbierta(true)}>
              <SpellCheck className="w-4 h-4" /> Ortografía
            </Button>
          )}
          {puedeBorrar && (
            <Button variant="destructive" size="sm" className="gap-1.5" disabled={!seleccion.size} onClick={() => setConfirmarBorrado(true)}>
              <Trash2 className="w-4 h-4" /> Borrar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={salirSeleccion}><X className="w-4 h-4" /></Button>
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">
            {isClienteObra
              ? 'No tienes partes de trabajo asignados a tu empresa'
              : 'No se encontraron partes'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(order => (
               <WorkOrderCard
              key={order.id}
              order={order}
              seleccionable={modoSeleccion}
              seleccionado={seleccion.has(order.id)}
              onToggle={toggleSeleccion}
            />       ))}
        </div>
      )}
      </div>

      <RevisionOrtograficaDialog open={revisionAbierta} onOpenChange={setRevisionAbierta} orders={filtered} />
      <RevisionOrtograficaDialog open={revSelAbierta} onOpenChange={setRevSelAbierta} orders={partesSeleccionados()} />
      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {seleccion.size} parte(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las fotos asociadas a los partes no se borran de la galería.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={borrando}
              onClick={(e) => { e.preventDefault(); borrarSeleccion(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {borrando ? 'Borrando…' : 'Sí, borrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}