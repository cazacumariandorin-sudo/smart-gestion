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
  Wallet, Utensils, Plus, Search, Loader2, CreditCard, CheckCircle2, XCircle, ChevronDown,
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
  const [filtroObra, setFiltroObra] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [actualizandoId, setActualizandoId] = useState(null);
  const [kpiActiva, setKpiActiva] = useState(null);
  const [expandidos, setExpandidos] = useState(() => new Set());

  const eur = (n) => `${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;

  // Las tarjetas de resumen actúan como filtros rápidos: al pulsar una,
  // acotan la lista al subconjunto que representa; pulsarla de nuevo la desactiva.
  const activarKpi = (k) => {
    setKpiActiva(prev => {
      if (prev === k) {
        // toggle off: limpia tipo/estado y deja el resto
        setFiltroTipo('todos');
        setFiltroEstado('todos');
        return null;
      }
      if (k === 'gastos') { setFiltroTipo('gastos'); setFiltroEstado('todos'); }
      else if (k === 'dieta') { setFiltroTipo('dieta'); setFiltroEstado('todos'); }
      else if (k === 'total') { setFiltroTipo('todos'); setFiltroEstado('todos'); }
      else if (k === 'registros') {
        setFiltroTipo('todos'); setFiltroEstado('todos');
        setFiltroOperario('todos'); setFiltroObra('todos'); setBusqueda('');
      }
      return k;
    });
  };

  const toggleExpandido = (id) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
      if (filtroObra !== 'todos' && a.obra_id !== filtroObra) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const txt = `${a.concepto || ''} ${a.operario_name || ''} ${a.obra_name || ''} ${a.notas || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [adelantos, tipoVisible, filtroEstado, filtroOperario, filtroObra, busqueda]);

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

  const obrasConAdelanto = useMemo(() => {
    const set = new Map();
    adelantos.forEach(a => { if (a.obra_id && a.obra_name) set.set(a.obra_id, a.obra_name); });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [adelantos]);

  // Agrupación por técnico para la visualización: cabecera con nombre,
  // total entregado y nº de registros, y debajo sus adelantos.
  const grupos = useMemo(() => {
    const map = new Map();
    for (const a of filtrados) {
      const key = a.operario_id || '__sin_operario';
      if (!map.has(key)) map.set(key, { id: key, name: a.operario_name || 'Sin operario', items: [], total: 0 });
      const g = map.get(key);
      g.items.push(a);
      g.total += a.importe || 0;
    }
    return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name, 'es'));
  }, [filtrados]);

  return (
    <div className="space-y-4">
      {/* KPIs — clicables: filtran la lista al subconjunto que representan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => activarKpi('gastos')}
          className={cn(
            'text-left bg-card border rounded-2xl p-4 transition-all hover:shadow-sm',
            kpiActiva === 'gastos' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Adelantos gastos (activos)</p>
          </div>
          <p className="text-lg font-bold">{totales.gastos.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
        </button>
        {puedeDieta && (
          <button
            type="button"
            onClick={() => activarKpi('dieta')}
            className={cn(
              'text-left bg-card border rounded-2xl p-4 transition-all hover:shadow-sm',
              kpiActiva === 'dieta' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Utensils className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-muted-foreground">Adelantos dieta (informativo)</p>
            </div>
            <p className="text-lg font-bold">{totales.dieta.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
          </button>
        )}
        <button
          type="button"
          onClick={() => activarKpi('total')}
          className={cn(
            'text-left bg-card border rounded-2xl p-4 transition-all hover:shadow-sm',
            kpiActiva === 'total' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'
          )}
        >
          <p className="text-xs text-muted-foreground mb-1">Total adelantos</p>
          <p className="text-lg font-bold">{totales.total.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</p>
        </button>
        <button
          type="button"
          onClick={() => activarKpi('registros')}
          className={cn(
            'text-left bg-card border rounded-2xl p-4 transition-all hover:shadow-sm',
            kpiActiva === 'registros' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'
          )}
        >
          <p className="text-xs text-muted-foreground mb-1">Registros</p>
          <p className="text-lg font-bold">{totales.count}</p>
        </button>
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
        <MobileSelect value={filtroObra} onValueChange={setFiltroObra} placeholder="Obra" triggerClassName="w-44">
          <MobileSelectItem value="todos">Todas las obras</MobileSelectItem>
          {obrasConAdelanto.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
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
            {busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos' || filtroOperario !== 'todos' || filtroObra !== 'todos'
              ? 'No hay adelantos con estos filtros'
              : 'No hay adelantos registrados aún'}
          </p>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Crear primer adelanto
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => {
            const abierto = expandidos.has(g.id) || (filtroOperario !== 'todos' && g.id === filtroOperario);
            return (
            <div key={g.id} className="bg-muted/30 border border-border rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpandido(g.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', abierto && 'rotate-180')} />
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {(g.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-sm truncate">{g.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{g.items.length}</Badge>
                </div>
                <span className="text-sm font-semibold text-muted-foreground shrink-0">{eur(g.total)}</span>
              </button>
              {abierto && (
              <div className="space-y-1.5 px-2 pb-2">
              {g.items.map(a => (
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
                        {a.fecha_entrega || '—'}
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
            </div>
            );
          })}
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