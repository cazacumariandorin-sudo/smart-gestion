import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, FileBarChart2, Receipt } from 'lucide-react';
import NotaGastoForm from '@/components/gastos/NotaGastoForm';
import NotaGastoCard from '@/components/gastos/NotaGastoCard';
import NotaGastoDetalle from '@/components/gastos/NotaGastoDetalle';
import InformeGastos from '@/components/gastos/InformeGastos';
import { useAuth } from '@/lib/AuthContext';
import { useOperarioName } from '@/hooks/useOperarioName';

const ESTADOS = ['todos', 'borrador', 'pendiente', 'validada', 'cerrada', 'rechazada'];
const CATEGORIAS = ['todas', 'material', 'combustible', 'peaje', 'parking', 'otros'];

export default function NotasGastos() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { getOperarioName, operarios } = useOperarioName();
  const qc = useQueryClient();

  // Resolve current user's operario name (if linked)
  const miOperario = operarios.find(op => op.user_email === user?.email);
  const miNombre = miOperario?.name || user?.full_name || user?.email || '';

  const [showForm, setShowForm] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  const [tab, setTab] = useState('notas'); // notas | informe
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  const { data: notasRaw = [], isLoading } = useQuery({
    queryKey: ['notas_gasto'],
    queryFn: () => base44.entities.NotaGasto.list('-created_date', 300),
  });

  // Operario actual: usa el nombre del operario vinculado si existe
  const operarioActual = {
    id: miOperario?.id || user?.id,
    name: miNombre,
    email: user?.email,
  };

  const notas = notasRaw.filter(n => {
    const txt = busqueda.toLowerCase();
    const matchBusq = !txt || (n.numero_nota || '').toLowerCase().includes(txt) ||
      (n.nombre_comercio || '').toLowerCase().includes(txt) ||
      (n.concepto || '').toLowerCase().includes(txt) ||
      (n.operario_name || '').toLowerCase().includes(txt);
    const matchEstado = filtroEstado === 'todos' || n.estado === filtroEstado;
    const matchCat = filtroCategoria === 'todas' || n.categoria === filtroCategoria;
    return matchBusq && matchEstado && matchCat;
  });

  const totalFiltrado = notas.reduce((s, n) => s + (n.importe || 0), 0);
  const pendientes = notasRaw.filter(n => n.estado === 'pendiente').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> Notas de Gastos
          </h1>
          {isAdmin && pendientes > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{pendientes} nota{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de validar</p>
          )}
        </div>
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
          <Button onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nueva nota
          </Button>
        </div>
      </div>

      {/* Informe */}
      {tab === 'informe' && (
        <div className="mb-6">
          <InformeGastos operario={operarioActual} notas={notasRaw} isAdmin={isAdmin} />
        </div>
      )}

      {/* Filtros */}
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
      </div>

      {/* Resumen rápido */}
      {notas.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1 flex-wrap">
          <span className="text-sm text-muted-foreground">{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
          <span className="font-semibold text-sm">Total: {totalFiltrado.toFixed(2)} €</span>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : notas.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {busqueda || filtroEstado !== 'todos' || filtroCategoria !== 'todas'
              ? 'No hay notas con estos filtros'
              : 'No hay notas de gastos aún'}
          </p>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Crear primera nota
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notas.map(nota => (
            <NotaGastoCard key={nota.id} nota={nota} onVer={setNotaSeleccionada} />
          ))}
        </div>
      )}

      {/* Form crear */}
      <NotaGastoForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['notas_gasto'] })}
        operario={operarioActual}
      />

      {/* Detalle */}
      {notaSeleccionada && (
        <NotaGastoDetalle
          nota={notaSeleccionada}
          isAdmin={isAdmin}
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