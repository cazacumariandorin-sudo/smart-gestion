import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Package, ClipboardList, Users, Car } from 'lucide-react';
import { FIRMA_STATUS_LABELS } from '@/lib/workOrderUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

export default function MonthlyReport() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: workOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-date', 500),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const monthOrders = useMemo(() => {
    return workOrders.filter(o => {
      if (!o.date) return false;
      const d = parseISO(o.date);
      return d >= monthStart && d <= monthEnd;
    });
  }, [workOrders, monthStart, monthEnd]);

  const clientStats = useMemo(() => {
    const map = {};

    monthOrders.forEach(order => {
      const clientId = order.client_id || 'sin_cliente';
      if (!map[clientId]) {
        const clientObj = clients.find(c => c.id === clientId);
        map[clientId] = {
          clientId,
          clientName: clientObj?.name || order.client_name || 'Sin cliente',
          orders: [],
          totalHours: 0,
          materials: {},
          workerSummary: {},
          totalKm: 0,
          totalDespEur: 0,
        };
      }
      map[clientId].orders.push(order);
      map[clientId].totalHours += order.total_hours || 0;

      (order.materials || []).forEach(mat => {
        const key = `${mat.name}__${mat.unit}`;
        if (!map[clientId].materials[key]) {
          map[clientId].materials[key] = { name: mat.name, unit: mat.unit, quantity: 0 };
        }
        map[clientId].materials[key].quantity += mat.quantity || 0;
      });

      (order.workers || []).forEach(w => {
        if (!map[clientId].workerSummary[w.name]) {
          map[clientId].workerSummary[w.name] = { name: w.name, hours: 0 };
        }
        map[clientId].workerSummary[w.name].hours += w.hours || 0;
      });
    });

    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [monthOrders, clients]);

  const totalMonthHours = clientStats.reduce((s, c) => s + c.totalHours, 0);
  const totalMonthOrders = monthOrders.length;
  const isLoading = loadingOrders || loadingClients;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Informe Mensual</h1>
        <p className="text-sm text-muted-foreground mt-1">Horas y materiales por cliente</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize min-w-40 text-center">
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <ClipboardList className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold">{totalMonthOrders}</p>
          <p className="text-xs text-muted-foreground">Partes</p>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold">{totalMonthHours}</p>
          <p className="text-xs text-muted-foreground">Horas totales</p>
        </Card>
        <Card className="p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold">{clientStats.length}</p>
          <p className="text-xs text-muted-foreground">Clientes</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : clientStats.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay partes en este mes</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {clientStats.map((cs) => (
            <AccordionItem
              key={cs.clientId}
              value={cs.clientId}
              className="border border-border rounded-xl overflow-hidden bg-card px-0"
            >
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/30">
                <div className="flex items-center justify-between w-full mr-3">
                  <div className="text-left">
                    <p className="font-semibold text-sm">{cs.clientName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cs.orders.length} parte{cs.orders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-accent text-accent-foreground border border-accent font-semibold">
                      <Clock className="w-3 h-3 mr-1" />
                      {cs.totalHours}h
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {Object.keys(cs.materials).length} mat.
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-5 pb-5">
                <div className="grid sm:grid-cols-2 gap-4 mt-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Horas por operario
                    </h4>
                    {Object.keys(cs.workerSummary).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin operarios registrados</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.values(cs.workerSummary)
                          .sort((a, b) => b.hours - a.hours)
                          .map((w, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium">{w.name}</span>
                            <span className="text-xs font-bold text-primary">{w.hours}h</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3 py-2 border-t border-border mt-1">
                          <span className="text-xs font-semibold">Total</span>
                          <span className="text-xs font-bold text-primary">{cs.totalHours}h</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Materiales utilizados
                    </h4>
                    {Object.keys(cs.materials).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin materiales registrados</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.values(cs.materials)
                          .sort((a, b) => b.quantity - a.quantity)
                          .map((m, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {m.quantity} {m.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Partes del mes
                  </h4>
                  <div className="space-y-1.5">
                    {cs.orders.map(order => (
                      <div key={order.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                        <div>
                          <span className="font-medium">{order.project}</span>
                          <span className="text-muted-foreground ml-2">
                            {order.date ? format(parseISO(order.date), 'd MMM', { locale: es }) : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-semibold">{order.total_hours || 0}h</span>
                          <Badge
                            variant="outline"
                            className={
                              order.status === 'completado' ? 'border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]' :
                              order.status === 'en_curso' ? 'border-blue-200 text-blue-700 bg-blue-50 text-[10px]' :
                              'border-amber-200 text-amber-700 bg-amber-50 text-[10px]'
                            }
                          >
                            {order.status === 'completado' ? 'Completado' : order.status === 'en_curso' ? 'En curso' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
