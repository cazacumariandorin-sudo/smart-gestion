import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { format, parseISO, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Search, Download, ChevronRight } from 'lucide-react';

export default function InformeTableView() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const { data: fichajes = [] } = useQuery({
    queryKey: ['fichajes_list'],
    queryFn: () => base44.entities.Fichaje.list('-date', 500),
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios_list'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  // Procesar datos para la tabla
  const tableData = useMemo(() => {
    const dayStart = startOfDay(parseISO(selectedDate));
    const dayEnd = endOfDay(parseISO(selectedDate));

    // Agrupar fichajes por operario en el día seleccionado
    const grouped = {};
    fichajes.forEach(f => {
      const fDate = parseISO(f.date);
      if (fDate >= dayStart && fDate <= dayEnd) {
        if (!grouped[f.operario_id]) {
          grouped[f.operario_id] = {
            operario_id: f.operario_id,
            operario_name: f.operario_name,
            entries: [],
          };
        }
        grouped[f.operario_id].entries.push(f);
      }
    });

    // Calcular métricas por operario
    return Object.values(grouped).map(group => {
      const entries = group.entries.sort((a, b) => (a.hora_entrada || '').localeCompare(b.hora_entrada || ''));
      const entrada = entries[0]?.hora_entrada || null;
      const ultima_salida = entries[entries.length - 1]?.hora_salida || null;
      
      // Contar paradas (pausas)
      const paradas = entries.filter(e => e.pausa_inicio && e.pausa_fin).length;
      
      // Registros sin cerrar (sin hora de salida)
      const sinCerrar = entries.filter(e => !e.hora_salida).length;
      
      // Tiempo total trabajado
      let totalMinutos = 0;
      entries.forEach(e => {
        if (e.hora_entrada && e.hora_salida) {
          const [hE, mE] = (e.hora_entrada || '').split(':').map(Number);
          const [hS, mS] = (e.hora_salida || '').split(':').map(Number);
          const minutosE = hE * 60 + mE;
          const minutosS = hS * 60 + mS;
          let diff = minutosS - minutosE;
          
          // Restar pausa
          if (e.pausa_inicio && e.pausa_fin) {
            const [hPI, mPI] = (e.pausa_inicio || '').split(':').map(Number);
            const [hPF, mPF] = (e.pausa_fin || '').split(':').map(Number);
            const pausaMinutos = (hPF * 60 + mPF) - (hPI * 60 + mPI);
            diff = Math.max(0, diff - pausaMinutos);
          }
          totalMinutos += Math.max(0, diff);
        }
      });

      const horas = Math.floor(totalMinutos / 60);
      const minutos = totalMinutos % 60;
      const tiempoTotal = `${horas}h ${minutos}min`;

      return {
        operario_id: group.operario_id,
        operario_name: group.operario_name,
        entrada,
        ultima_salida,
        paradas,
        sinCerrar,
        tiempoTotal,
        entries,
      };
    });
  }, [fichajes, selectedDate]);

  // Filtrar por búsqueda
  const filtered = tableData.filter(row => {
    const q = search.toLowerCase();
    return !search || row.operario_name.toLowerCase().includes(q);
  });

  const dateObj = parseISO(selectedDate);
  const dateLabel = format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="space-y-4">
      {/* Header con fecha */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">Visión general del día</p>
          <h2 className="text-lg sm:text-xl font-semibold capitalize">{dateLabel}</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre de operario..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Empleado</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Entrada</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Última salida</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Nº paradas</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Registros sin cerrar</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Tiempo total</th>
                <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Operaciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No hay registros con ese filtro' : 'No hay fichajes para este día'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.operario_id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">
                          {row.operario_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{row.operario_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono">{row.entrada || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm font-mono">{row.ultima_salida || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.paradas}</td>
                    <td className={`px-4 py-3 text-center text-sm font-semibold ${row.sinCerrar > 0 ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' : ''}`}>
                      {row.sinCerrar}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{row.tiempoTotal}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Total operarios</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Sin cerrar</p>
            <p className="text-2xl font-bold text-red-600">{filtered.reduce((s, r) => s + r.sinCerrar, 0)}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Tiempo promedio</p>
            <p className="text-2xl font-bold">{Math.round(filtered.reduce((s, r) => {
              const [h, rest] = r.tiempoTotal.split('h');
              const m = rest.match(/\d+/)[0];
              return s + (parseInt(h) * 60 + parseInt(m));
            }, 0) / filtered.length / 60)}h</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Total paradas</p>
            <p className="text-2xl font-bold">{filtered.reduce((s, r) => s + r.paradas, 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
}