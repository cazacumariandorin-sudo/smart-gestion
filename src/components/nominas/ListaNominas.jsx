import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Search, User, Calendar, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ListaNominas({ esAdmin }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());

  const { data: nominas = [], isLoading } = useQuery({
    queryKey: ['nominas', filtroMes, filtroAnio],
    queryFn: () => base44.entities.Nomina.list('-created_date', 200),
  });

  const nominasFiltradas = nominas.filter(n => {
    const coincideBusqueda = !busqueda ||
      (n.operario_name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.operario_dni || '').toLowerCase().includes(busqueda.toLowerCase());
    const coincideMes = !filtroMes || n.mes === parseInt(filtroMes);
    const coincideAnio = !filtroAnio || n.anio === parseInt(filtroAnio);
    return coincideBusqueda && coincideMes && coincideAnio;
  });

  // Agrupar por lote
  const porLote = nominasFiltradas.reduce((acc, nom) => {
    const key = nom.lote_id || `${nom.mes}_${nom.anio}`;
    if (!acc[key]) acc[key] = { periodo: nom.periodo, mes: nom.mes, anio: nom.anio, nominas: [] };
    acc[key].nominas.push(nom);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trabajador o DNI..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos los meses</option>
          {MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filtroAnio}
          onChange={e => setFiltroAnio(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Lista agrupada por lote */}
      {Object.keys(porLote).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay nóminas para los filtros seleccionados</p>
        </div>
      ) : (
        Object.entries(porLote).map(([loteKey, lote]) => (
          <div key={loteKey} className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{lote.periodo}</span>
                <Badge variant="secondary" className="text-xs">{lote.nominas.length} nóminas</Badge>
              </div>
              {esAdmin && (
                <span className="text-xs text-muted-foreground">
                  {lote.nominas.filter(n => n.estado_asignacion === 'sin_asignar').length > 0 && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {lote.nominas.filter(n => n.estado_asignacion === 'sin_asignar').length} sin asignar
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {lote.nominas.map(nom => (
                <div key={nom.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{nom.operario_name || 'Sin asignar'}</p>
                    <p className="text-xs text-muted-foreground">DNI: {nom.operario_dni || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {nom.liquido_percibir && (
                      <p className="font-semibold text-sm">
                        {nom.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </p>
                    )}
                    <Badge
                      variant={nom.estado_asignacion === 'asignada' ? 'default' : 'outline'}
                      className="text-[10px]"
                    >
                      {nom.estado_asignacion === 'asignada' ? 'Asignada' : 'Sin asignar'}
                    </Badge>
                  </div>
                  {nom.file_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="shrink-0 w-8 h-8"
                    >
                      <a href={nom.file_url} target="_blank" rel="noopener noreferrer" title="Ver PDF">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}