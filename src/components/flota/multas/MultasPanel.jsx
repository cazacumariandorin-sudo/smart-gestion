import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Plus, Loader2, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ESTADO_MULTA, ESTADOS_RESUELTOS, estadoLabel, estadoColor } from './multaConstants';
import MultaCard from './MultaCard';
import MultaFormDialog from './MultaFormDialog';
import MultaDetalleDialog from './MultaDetalleDialog';

export default function MultasPanel({ vehiculos = [] }) {
  const { isGerencia, isAdministracion, isAdmin } = useUserRole();
  const puedeGestionar = isGerencia || isAdministracion || isAdmin;

  const [filtroEstado, setFiltroEstado] = useState('pendientes');
  const [filtroVehiculo, setFiltroVehiculo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [multaSel, setMultaSel] = useState(null);

  const { data: multas = [], isLoading } = useQuery({
    queryKey: ['multas-vehiculo', vehiculos.map(v => v.id).join(',')],
    queryFn: () => base44.entities.MultaVehiculo.list('-fecha_multa', 500),
    enabled: vehiculos.length > 0,
  });

  const multasFiltradas = useMemo(() => {
    let res = multas;
    if (filtroEstado === 'pendientes') {
      res = res.filter(m => !ESTADOS_RESUELTOS.includes(m.estado));
    } else if (filtroEstado !== 'todos') {
      res = res.filter(m => m.estado === filtroEstado);
    }
    if (filtroVehiculo !== 'todos') {
      res = res.filter(m => m.vehiculo_id === filtroVehiculo);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      res = res.filter(m =>
        (m.vehiculo_matricula || '').toLowerCase().includes(q) ||
        (m.autoridad || '').toLowerCase().includes(q) ||
        (m.numero_expediente || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [multas, filtroEstado, filtroVehiculo, busqueda]);

  const pendientesCount = multas.filter(m => !ESTADOS_RESUELTOS.includes(m.estado)).length;

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[160px]">
          <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado} triggerClassName="w-full">
            <MobileSelectItem value="todos">Todas las multas</MobileSelectItem>
            <MobileSelectItem value="pendientes">Pendientes ({pendientesCount})</MobileSelectItem>
            {Object.entries(ESTADO_MULTA).map(([k, v]) => (
              <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>
        <div className="flex-1 min-w-[160px]">
          <MobileSelect value={filtroVehiculo} onValueChange={setFiltroVehiculo} triggerClassName="w-full">
            <MobileSelectItem value="todos">Todos los vehículos</MobileSelectItem>
            {vehiculos.map(v => (
              <MobileSelectItem key={v.id} value={v.id}>{v.matricula} — {v.modelo}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar matrícula, autoridad, expediente…"
          className="flex-1 min-w-[160px]"
        />
        {puedeGestionar && (
          <Button onClick={() => setOpenForm(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Nueva multa
          </Button>
        )}
      </div>

      {/* Listado */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : multasFiltradas.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
          <p className="text-sm text-muted-foreground">No hay multas que coincidan con el filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {multasFiltradas.map(m => (
            <MultaCard key={m.id} multa={m} onClick={setMultaSel} />
          ))}
        </div>
      )}

      <MultaFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        vehiculos={vehiculos}
      />
      <MultaDetalleDialog
        multa={multaSel}
        open={!!multaSel}
        onOpenChange={(o) => { if (!o) setMultaSel(null); }}
      />
    </div>
  );
}