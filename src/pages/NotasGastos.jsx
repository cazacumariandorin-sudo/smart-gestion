import { useState, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Plus, Search, Filter, FileBarChart2, Receipt, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotaGastoForm from '@/components/gastos/NotaGastoForm';
import NotaGastoCard from '@/components/gastos/NotaGastoCard';
import NotaGastoDetalle from '@/components/gastos/NotaGastoDetalle';
import InformeGastos from '@/components/gastos/InformeGastos';
import { useAuth } from '@/lib/AuthContext';
import { useOperarioName } from '@/hooks/useOperarioName';

const ESTADOS = ['todos', 'borrador', 'pendiente', 'validada', 'cerrada', 'rechazada'];
const CATEGORIAS = ['todas', 'material', 'combustible', 'peaje', 'parking', 'otros'];

function OperarioGroup({ operario, notas, onVerNota, isOpen, onToggle }) {
  const total = notas.reduce((s, n) => s + (n.importe || 0), 0);
  const pendientes = notas.filter(n => n.estado === 'pendiente').length;
  
  return (
    <Card className="mb-3">
      <button
        onClick={onToggle}
        className="w-full"
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-base">{operario.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {notas.length} registro{notas.length !== 1 ? 's' : ''} • {total.toFixed(2)} €
                  {pendientes > 0 && <span className="ml-2 text-amber-600">• {pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {notas.length} notas
            </Badge>
          </div>
        </CardHeader>
      </button>
      
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-2 mt-2">
            {notas.map(nota => (
              <NotaGastoCard key={nota.id} nota={nota} onVer={onVerNota} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function NotasGastos() {
  const { user } = useAuth();
  const { isAdmin, isOperario, isGerencia } = useUserRole();
  const { getOperarioName, operarios } = useOperarioName();
  const qc = useQueryClient();

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  // Buscar operario por email o usar el usuario actual si es operario
  const miOperario = operarios.find(op => op.user_email === user?.email);
  const miNombre = miOperario?.name || user?.full_name || user?.email || '';
  
  // Para operarios, usar su ID de usuario si no tienen registro en Operario
  const operarioId = miOperario?.id || (isOperario ? user?.id : null);

  const [showForm, setShowForm] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  const [tab, setTab] = useState('notas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroOperario, setFiltroOperario] = useState('todos');
  const [filtroObra, setFiltroObra] = useState('todas');
  const [filtroSinObra, setFiltroSinObra] = useState(false);
  const [operarioAbierto, setOperarioAbierto] = useState(null);

  const { data: notasRaw = [], isLoading } = useQuery({
    queryKey: ['notas_gasto'],
    queryFn: () => base44.entities.RegistroGasto.list('-created_date', 1000),
  });

  const { data: obrasRaw = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });

  const operarioActual = {
    id: operarioId || user?.id,
    name: miOperario?.name || user?.full_name || user?.email?.split('@')[0],
    user_email: user?.email,
  };
  
  // Verificar si puede crear: operarios siempre pueden, admins/gerencia también
  const puedeCrearRegistro = isOperario || isAdmin || isGerencia || !!miOperario?.id;

  const notas = notasRaw.filter(n => {
    const txt = busqueda.toLowerCase();
    const matchBusq = !txt || (n.numero_nota || '').toLowerCase().includes(txt) ||
      (n.nombre_comercio || '').toLowerCase().includes(txt) ||
      (n.concepto || '').toLowerCase().includes(txt) ||
      (n.operario_name || '').toLowerCase().includes(txt);
    const matchEstado = filtroEstado === 'todos' || n.estado === filtroEstado;
    const matchCat = filtroCategoria === 'todas' || n.categoria === filtroCategoria;
    const matchOp = filtroOperario === 'todos' || n.operario_id === filtroOperario;
    const matchObra = filtroObra === 'todas' || n.obra_id === filtroObra;
    const matchSinObra = !filtroSinObra || n.sin_obra === true;
    return matchBusq && matchEstado && matchCat && matchOp && matchObra && matchSinObra;
  });

  const totalFiltrado = notas.reduce((s, n) => s + (n.importe || 0), 0);
  const pendientes = notasRaw.filter(n => n.estado === 'pendiente').length;

  const operariosConNotas = {};
  notas.forEach(nota => {
    const opId = nota.operario_id || 'sin-asignar';
    const opName = nota.operario_name || 'Sin asignar';
    if (!operariosConNotas[opId]) {
      operariosConNotas[opId] = { id: opId, name: opName, notas: [] };
    }
    operariosConNotas[opId].notas.push(nota);
  });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Registros de Gasto"
        subtitle={isAdmin && pendientes > 0 ? `${pendientes} pendiente${pendientes > 1 ? 's' : ''} de validar` : undefined}
        hideBack={true}
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === 'informe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(tab === 'informe' ? 'notas' : 'informe')}
              className="gap-1.5"
            >
              <FileBarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Informe</span>
            </Button>
            <Button 
              onClick={() => setShowForm(true)} 
              size="sm" 
              className="gap-1.5"
              disabled={!puedeCrearRegistro}
            >
              <Plus className="w-4 h-4" /> Nuevo Registro
            </Button>
          </div>
        }
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      {tab === 'informe' && (
        <div className="mb-6">
          <InformeGastos operario={operarioActual} notas={notasRaw} isAdmin={isAdmin} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, comercio, concepto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado} placeholder="Estado" triggerClassName="w-36">
          {ESTADOS.map(e => <MobileSelectItem key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={filtroCategoria} onValueChange={setFiltroCategoria} placeholder="Categoría" triggerClassName="w-36">
          {CATEGORIAS.map(c => <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={filtroObra} onValueChange={setFiltroObra} placeholder="Obra" triggerClassName="w-40">
          <MobileSelectItem value="todas">Todas las obras</MobileSelectItem>
          {obrasRaw.map(obra => (
            <MobileSelectItem key={obra.id} value={obra.id}>{obra.name}</MobileSelectItem>
          ))}
        </MobileSelect>
        {isAdmin && operarios.length > 0 && (
          <MobileSelect value={filtroOperario} onValueChange={setFiltroOperario} placeholder="Operario" triggerClassName="w-40">
            <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
            {operarios.filter(op => op.active !== false).map(op => (
              <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
            ))}
          </MobileSelect>
        )}
        {isAdmin && (
          <button
            onClick={() => setFiltroSinObra(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
              filtroSinObra
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-background border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600'
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            Sin obra
          </button>
        )}
      </div>

      {notas.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1 flex-wrap">
          <span className="text-sm text-muted-foreground">{Object.keys(operariosConNotas).length} operario{Object.keys(operariosConNotas).length !== 1 ? 's' : ''}</span>
          <span className="font-semibold text-sm">Total: {totalFiltrado.toFixed(2)} €</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : Object.keys(operariosConNotas).length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {busqueda || filtroEstado !== 'todos' || filtroCategoria !== 'todas' || filtroOperario !== 'todos' || filtroObra !== 'todas'
              ? 'No hay registros con estos filtros'
              : 'No hay registros de gasto aún'}
          </p>
          <Button 
            size="sm" 
            onClick={() => setShowForm(true)} 
            className="gap-1.5"
            disabled={!puedeCrearRegistro}
          >
            <Plus className="w-4 h-4" /> Crear primer registro
          </Button>
        </div>
      ) : (
        <div>
          {Object.values(operariosConNotas).map(operario => (
            <OperarioGroup
              key={operario.id}
              operario={operario}
              notas={operario.notas}
              onVerNota={setNotaSeleccionada}
              isOpen={operarioAbierto === operario.id}
              onToggle={() => setOperarioAbierto(operarioAbierto === operario.id ? null : operario.id)}
            />
          ))}
        </div>
      )}

      </div>
      <NotaGastoForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['notas_gasto'] })}
        operario={operarioActual}
        isAdmin={isAdmin}
        operarios={operarios}
      />

      {notaSeleccionada && (
        <NotaGastoDetalle
          nota={notaSeleccionada}
          isAdmin={isAdmin}
          operarios={operarios}
          open={!!notaSeleccionada}
          onClose={() => {
            setNotaSeleccionada(null);
            qc.invalidateQueries({ queryKey: ['notas_gasto'] });
          }}
        />
      )}
    </div>
  );
}