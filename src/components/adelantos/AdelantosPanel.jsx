import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Wallet, Utensils, Plus, Search, Loader2, CreditCard, CheckCircle2, XCircle,
} from 'lucide-react';
import AdelantoFormDialog from './AdelantoFormDialog';

const ESTADO_LABELS = {
  pendiente_entrega: 'Pendiente entrega',
  entregado: 'Entregado',
  justificado: 'Justificado',
  parcialmente_justificado: 'Parcial',
  pendiente_devolucion: 'Pend. devolución',
  anulado: 'Anulado',
};
const ESTADO_COLORS = {
  pendiente_entrega: 'bg-slate-100 text-slate-700 border-slate-200',
  entregado: 'bg-blue-50 text-blue-700 border-blue-200',
  justificado: 'bg-green-50 text-green-700 border-green-200',
  parcialmente_justificado: 'bg-amber-50 text-amber-700 border-amber-200',
  pendiente_devolucion: 'bg-red-50 text-red-700 border-red-200',
  anulado: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
};
const METODOS = { transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta_empresa: 'Tarjeta empresa', sepa: 'SEPA' };

export default function AdelantosPanel() {
  const { user } = useAuth();
  const { isAdmin, isGerencia, isDirComercial, isAdministracion } = useUserRole();
  const qc = useQueryClient();
  const puedeDieta = isAdmin || isGerencia;

  const [showForm, setShowForm] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroOperario, setFiltroOperario] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [actualizandoId, setActualizandoId] = useState(null);

  const { data: adelantos = [], isLoading } = useQuery({
    queryKey: ['adelantos'],
    queryFn: () => base44.entities.Adelanto.list('-fecha_entrega', 500),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['adelanto_panel_operarios'],
    queryFn: () => base44.entities.Operario.list('name', 300),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['adelantos'] });
    qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
  };

  // El director_comercial solo ve tipo gastos (RLS ya filtra, pero también en UI)
  const tipoVisible = puedeDieta ? filtroTipo : 'gastos';

  const filtrados = useMemo(() => {
    return adelantos.filter(a => {
      if (tipoVisible !== 'todos' && a.tipo !== tipoVisible) return false;
      if (filtroEstado !== 'todos' && a.estado !== filtroEstado) return false;
      if (filtroOperario !== 'todos' && a.operario_id !== filtroOperario) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const txt = `${a.concepto || ''} ${a.operario_name || ''} ${a.notas || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [adelantos, tipoVisible, filtroEstado, filtroOperario, busqueda]);

  const totales = useMemo(() => {
    const activos = filtrados.filter(a => ['entregado', 'justificado', 'parcialmente_justificado'].includes(a.estado));
    const tg = activos.filter(a => a.tipo === 'gastos').reduce((s, a) => s + (a.importe || 0), 0);
    const td = activos.filter(a => a.tipo === 'dieta').reduce((s, a) => s + (a.importe || 0), 0);
    return { gastos: tg, dieta: td, total: tg + td, count: filtrados.length };
  }, [filtrados]);

  const cambiarEstado = async (adelanto, nuevoEstado, extra = {}) => {
    setActualizandoId(adelanto.id);
    try {
      const patch = { estado: nuevoEstado, ...extra };
      const ahora = new Date().toISOString();
      if (nuevoEstado === 'entregado') {
        patch.entregado_por = user?.email;
        patch.fecha_entrega_real = ahora;
        if (!patch.metodo_pago) patch.metodo_pago = 'efectivo';
      } else if (nuevoEstado === 'anulado') {
        patch.notas = (adelanto.notas || '') + `\n[Anulado por ${user?.email} el ${ahora}]`;
      }
      await base44.entities.Adelanto.update(adelanto.id, patch);
      toast.success(`Adelanto marcado como ${ESTADO_LABELS[nuevoEstado]}`);
      invalidar();
    } catch (e) {
      toast.error(e.message || 'Error al actualizar el adelanto');
    } finally {
      setActualizandoId(null);
    }
  };

  const operariosConAdelanto = useMemo(() => {
    const set = new Map();
    adelantos.forEach(a => { if (a.operario_id) set.set(a.operario_id, a.operario_name || a.operario_id); });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [adelantos]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Adelantos gastos (activos)</p>
          </div>
          <p className="text-lg font-bold">{totales.gastos.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
        </div>
        {puedeDieta && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Utensils className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-muted-foreground">Adelantos dieta (informativo)</p>
            </div>
            <p className="text-lg font-bold">{totales.dieta.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
          </div>
        )}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total adelantos</p>
          <p className="text-lg font-bold">{totales.total.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Registros</p>
          <p className="text-lg font-bold">{totales.count}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por concepto, operario…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {puedeDieta && (
          <MobileSelect value={filtroTipo} onValueChange={setFiltroTipo} placeholder="Tipo" triggerClassName="w-36">
            <MobileSelectItem value="todos">Todos los tipos</MobileSelectItem>
            <MobileSelectItem value="gastos">Gastos</MobileSelectItem>
            <MobileSelectItem value="dieta">Dieta</MobileSelectItem>
          </MobileSelect>
        )}
        <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado} placeholder="Estado" triggerClassName="w-40">
          <MobileSelectItem value="todos">Todos los estados</MobileSelectItem>
          {Object.entries(ESTADO_LABELS).map(([v, l]) => <MobileSelectItem key={v} value={v}>{l}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={filtroOperario} onValueChange={setFiltroOperario} placeholder="Operario" triggerClassName="w-40">
          <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
          {operariosConAdelanto.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
        </MobileSelect>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5 ml-auto">
          <Plus className="w-4 h-4" /> Nuevo adelanto
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando adelantos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">
            {busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos' || filtroOperario !== 'todos'
              ? 'No hay adelantos con estos filtros'
              : 'No hay adelantos registrados aún'}
          </p>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Crear primer adelanto
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  a.tipo === 'dieta' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                )}>
                  {a.tipo === 'dieta' ? <Utensils className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{(a.importe || 0).toFixed(2)} €</span>
                    <Badge variant="outline" className={cn('text-[10px]', ESTADO_COLORS[a.estado])}>{ESTADO_LABELS[a.estado]}</Badge>
                    {a.tipo === 'dieta' && <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Dieta</Badge>}
                    {a.obra_name && <span className="text-xs text-muted-foreground truncate">· {a.obra_name}</span>}
                  </div>
                  <p className="text-sm truncate">{a.concepto || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.operario_name || '—'} · {a.fecha_entrega || '—'}
                    {a.metodo_pago && ` · ${METODOS[a.metodo_pago] || a.metodo_pago}`}
                    {a.entregado_por && ` · entregó ${a.entregado_por}`}
                  </p>
                </div>
              </div>

              {/* Acciones (solo gerencia/admin/director_comercial para gastos; gerencia/admin para dieta) */}
              {a.estado !== 'anulado' && a.estado !== 'justificado' && (
                <div className="flex gap-1.5 shrink-0">
                  {a.estado === 'pendiente_entrega' && (isAdmin || isGerencia || isAdministracion) && (
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={actualizandoId === a.id}
                      onClick={() => cambiarEstado(a, 'entregado')}>
                      {actualizandoId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                      Entregar
                    </Button>
                  )}
                  {a.estado === 'pendiente_devolucion' && (
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-green-300 text-green-700" disabled={actualizandoId === a.id}
                      onClick={() => cambiarEstado(a, 'justificado')}>
                      {actualizandoId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Justificar
                    </Button>
                  )}
                  {(isAdmin || isGerencia || isAdministracion) && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" disabled={actualizandoId === a.id}
                      onClick={() => cambiarEstado(a, 'anulado')}>
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AdelantoFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => { setShowForm(false); invalidar(); }}
        operarios={operarios}
      />
    </div>
  );
}