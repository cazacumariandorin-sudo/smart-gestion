import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADOS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'solicitado', label: 'Solicitado' },
  { value: 'recibido', label: 'Recibido' },
];

const ESTADO_BADGE = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  solicitado: 'bg-blue-100 text-blue-700 border-blue-200',
  recibido: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const ESTADO_ACCIONES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'solicitado', label: 'Solicitar a proveedor' },
  { value: 'recibido', label: 'Recibido en obra' },
];

export default function MaterialPendiente() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hoy = new Date();
  const [filtroMes, setFiltroMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroObra, setFiltroObra] = useState('');

  const { data: materiales = [], isLoading } = useQuery({
    queryKey: ['materiales-pendientes', filtroMes, filtroEstado],
    queryFn: async () => {
      const [anioStr, mesStr] = filtroMes.split('-');
      const anio = Number(anioStr);
      const mesNum = Number(mesStr);
      const todos = await base44.entities.MaterialPendiente.list('-fecha_solicitud', 500);
      return todos.filter((m) => m.anio === anio && m.mes_numero === mesNum);
    },
  });

  const filtrados = useMemo(() => {
    return materiales.filter((m) => {
      if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false;
      if (filtroObra.trim() && !(m.obra_name || '').toLowerCase().includes(filtroObra.trim().toLowerCase())) return false;
      return true;
    });
  }, [materiales, filtroEstado, filtroObra]);

  // Agrupación jerárquica: cliente -> obra -> items
  const agrupado = useMemo(() => {
    const map = {};
    filtrados.forEach((m) => {
      const clienteKey = m.client_name || 'Sin cliente';
      const obraKey = m.obra_name || 'Sin obra';
      if (!map[clienteKey]) map[clienteKey] = { obras: {} };
      if (!map[clienteKey].obras[obraKey]) map[clienteKey].obras[obraKey] = { items: [] };
      map[clienteKey].obras[obraKey].items.push(m);
    });
    return map;
  }, [filtrados]);

  const actualizarEstado = useMutation({
    mutationFn: async ({ material, estado }) => {
      const payload = { estado };
      if (estado === 'recibido') {
        payload.fecha_resolucion = new Date().toISOString().split('T')[0];
        payload.resuelto_por = user?.email;
      } else {
        payload.fecha_resolucion = null;
        payload.resuelto_por = null;
      }
      return base44.entities.MaterialPendiente.update(material.id, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materiales-pendientes'] }),
  });

  const resumen = {
    total: filtrados.length,
    pendientes: filtrados.filter((m) => m.estado === 'pendiente').length,
    solicitados: filtrados.filter((m) => m.estado === 'solicitado').length,
    recibidos: filtrados.filter((m) => m.estado === 'recibido').length,
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader title="Material Pendiente" subtitle="Solicitudes de material centralizadas por fecha, obra y cliente" />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ResumenMat label="Total" valor={resumen.total} tone="slate" />
          <ResumenMat label="Pendientes" valor={resumen.pendientes} tone="amber" />
          <ResumenMat label="Solicitados" valor={resumen.solicitados} tone="blue" />
          <ResumenMat label="Recibidos" valor={resumen.recibidos} tone="emerald" />
        </div>

        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5" /> Filtros
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Mes</Label>
                <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Estado</Label>
                <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado}>
                  {ESTADOS.map((e) => <MobileSelectItem key={e.value} value={e.value}>{e.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Buscar obra</Label>
                <Input value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)} placeholder="Nombre de obra..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No hay solicitudes de material en el filtro seleccionado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(agrupado).map(([cliente, cg]) => (
              <div key={cliente} className="space-y-2">
                <h3 className="text-sm font-bold px-1 truncate">📁 {cliente}</h3>
                <div className="space-y-3 ml-1">
                  {Object.entries(cg.obras).map(([obra, og]) => (
                    <div key={obra} className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-muted-foreground px-1 truncate">🏗 {obra}</h4>
                      <div className="space-y-1.5">
                        {og.items.map((m) => (
                          <Card key={m.id}>
                            <CardContent className="p-3 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(new Date(m.fecha_solicitud), 'dd MMM yyyy', { locale: es })} · {m.solicitado_por_nombre || '—'}
                                  </p>
                                  <p className="text-sm whitespace-pre-wrap">{m.descripcion}</p>
                                </div>
                                <Badge className={`text-[10px] shrink-0 ${ESTADO_BADGE[m.estado] || ''}`}>{m.estado}</Badge>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Label className="text-[10px] shrink-0">Cambiar estado:</Label>
                                <MobileSelect
                                  value={m.estado}
                                  onValueChange={(v) => actualizarEstado.mutate({ material: m, estado: v })}
                                  triggerClassName="h-7 text-xs flex-1"
                                  disabled={actualizarEstado.isPending}
                                >
                                  {ESTADO_ACCIONES.map((e) => (
                                    <MobileSelectItem key={e.value} value={e.value}>{e.label}</MobileSelectItem>
                                  ))}
                                </MobileSelect>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumenMat({ label, valor, tone }) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  }[tone];
  return (
    <div className={`border rounded-lg p-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold truncate">{valor}</p>
    </div>
  );
}