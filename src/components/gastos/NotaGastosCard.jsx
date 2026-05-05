import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import {
  Plus, Trash2, Receipt, Loader2, X, ChevronDown, ChevronUp,
  Lock, Unlock, FileText, Fuel, ShoppingCart, Layers, Navigation, ParkingCircle,
  Wallet, Download, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddGastoDialog, AddAdelantoDialog } from './GastoDialogs';

const CATEGORIAS = [
  { key: 'combustible', label: 'Combustible', icon: Fuel,           color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'comida',      label: 'Comida',       icon: Utensils,       color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'material',    label: 'Material',     icon: ShoppingCart,   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'parking',     label: 'Parking',      icon: ParkingCircle,  color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'peaje',       label: 'Peaje',        icon: Navigation,     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'varios',      label: 'Otros',        icon: Layers,         color: 'bg-gray-100 text-gray-700 border-gray-200' },
];
const ADELANTO_CAT = { key: 'adelanto', label: 'Adelanto', icon: Wallet, color: 'bg-red-100 text-red-700 border-red-200' };
const ALL_CATS = [...CATEGORIAS, ADELANTO_CAT];

export default function NotaGastosCard({ nota, gastos, operarios, canSeeAll, myOperario, user }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addGastoOpen, setAddGastoOpen] = useState(false);
  const [addAdelantoOpen, setAddAdelantoOpen] = useState(false);
  const [ticketPreview, setTicketPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('gastos');

  const isCerrada = nota.estado === 'cerrada';
  const gastosNormales = gastos.filter(g => g.categoria !== 'adelanto');
  const adelantos = gastos.filter(g => g.categoria === 'adelanto');
  const totalGastos = gastosNormales.reduce((s, g) => s + (g.importe || 0), 0);
  const totalAdelantos = adelantos.reduce((s, g) => s + (g.importe || 0), 0);
  const total = gastos.reduce((s, g) => s + (g.importe || 0), 0);
  const saldo = totalGastos - totalAdelantos;

  const gastosPorCategoria = CATEGORIAS.reduce((acc, cat) => {
    const items = gastosNormales.filter(g => g.categoria === cat.key);
    if (items.length) acc[cat.key] = items;
    return acc;
  }, {});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['gastos_operarios'] });
    qc.invalidateQueries({ queryKey: ['notas_gastos'] });
  };

  const createGastoM = useMutation({
    mutationFn: async (d) => {
      const gasto = await base44.entities.GastoOperario.create(d);
      const newTotal = total + (parseFloat(d.importe) || 0);
      await base44.entities.NotaGastos.update(nota.id, { total: newTotal });
      return gasto;
    },
    onSuccess: () => {
      invalidate();
      setAddGastoOpen(false);
      setAddAdelantoOpen(false);
      toast.success('Gasto guardado');
    },
    onError: () => toast.error('Error al guardar el gasto'),
  });

  const deleteGastoM = useMutation({
    mutationFn: async (g) => {
      await base44.entities.GastoOperario.delete(g.id);
      const newTotal = Math.max(0, total - (g.importe || 0));
      await base44.entities.NotaGastos.update(nota.id, { total: newTotal });
    },
    onSuccess: () => { invalidate(); toast.success('Gasto eliminado'); },
    onError: () => toast.error('Error al eliminar'),
  });

  const cerrarNotaM = useMutation({
    mutationFn: () => base44.entities.NotaGastos.update(nota.id, {
      estado: 'cerrada', fecha_cierre: new Date().toISOString().split('T')[0], total
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notas_gastos'] }); toast.success('Nota cerrada'); }
  });

  const reabrirNotaM = useMutation({
    mutationFn: () => base44.entities.NotaGastos.update(nota.id, { estado: 'abierta', fecha_cierre: '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notas_gastos'] }); toast.success('Nota reabierta'); }
  });

  const deleteNotaM = useMutation({
    mutationFn: async () => {
      await Promise.all(gastos.map(g => base44.entities.GastoOperario.delete(g.id)));
      await base44.entities.NotaGastos.delete(nota.id);
    },
    onSuccess: () => { invalidate(); toast.success('Nota eliminada'); },
    onError: () => toast.error('Error al eliminar la nota'),
  });

  const handleSaveGasto = (formData) => {
    if (!formData.descripcion || !formData.categoria || !formData.importe) {
      toast.error('Rellena categoría, importe y descripción');
      return;
    }
    const pre = myOperario
      ? { operario_id: myOperario.id, operario_name: myOperario.name }
      : { operario_id: nota.operario_id, operario_name: nota.operario_name };
    createGastoM.mutate({
      ...pre,
      ...formData,
      nota_id: nota.id,
    });
  };

  const handleSaveAdelanto = (formData) => {
    const pre = myOperario
      ? { operario_id: myOperario.id, operario_name: myOperario.name }
      : { operario_id: nota.operario_id, operario_name: nota.operario_name };
    createGastoM.mutate({
      ...pre,
      ...formData,
      nota_id: nota.id,
      categoria: 'adelanto',
      descripcion: formData.descripcion || 'Adelanto',
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 18;
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
    doc.text('NOTA DE GASTOS', margin, 13);
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Ref: ${nota.titulo || `Nota ${nota.operario_name}`}`, margin, 21);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 140, 21);
    y = 38;
    doc.setTextColor(40, 40, 40); doc.setFontSize(9);
    doc.text(`Operario: ${nota.operario_name}`, margin, y);
    doc.text(`Período: ${nota.fecha_inicio ? format(parseISO(nota.fecha_inicio), 'dd/MM/yyyy') : '—'}${nota.fecha_cierre ? ` → ${format(parseISO(nota.fecha_cierre), 'dd/MM/yyyy')}` : ''}`, margin, y + 5);
    doc.text(`Estado: ${nota.estado === 'cerrada' ? 'CERRADA' : 'ABIERTA'}`, margin, y + 10);
    y += 18;
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, 196, y); y += 8;
    CATEGORIAS.forEach(cat => {
      const items = gastosNormales.filter(g => g.categoria === cat.key);
      if (!items.length) return;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setTextColor(60, 60, 60); doc.setFont(undefined, 'bold');
      doc.text(`${cat.label.toUpperCase()}`, margin, y); y += 5;
      items.forEach(g => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(8.5); doc.setTextColor(80, 80, 80); doc.setFont(undefined, 'normal');
        const desc = g.descripcion || g.proveedor || '—';
        const dateStr = g.date ? format(parseISO(g.date), 'dd/MM/yyyy') : '—';
        doc.text(`  ${dateStr}`, margin, y);
        doc.text(desc.length > 60 ? desc.substring(0, 60) + '...' : desc, margin + 22, y);
        doc.text(`${(g.importe || 0).toFixed(2)} €`, 180, y, { align: 'right' });
        y += 5;
      });
      const subtotal = items.reduce((s, g) => s + (g.importe || 0), 0);
      doc.setFont(undefined, 'bold'); doc.setTextColor(25, 25, 25);
      doc.text(`Subtotal ${cat.label}: ${subtotal.toFixed(2)} €`, 196, y, { align: 'right' });
      y += 7;
    });
    if (adelantos.length) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setDrawColor(220, 220, 220); doc.line(margin, y, 196, y); y += 6;
      doc.setFontSize(10); doc.setTextColor(180, 30, 30); doc.setFont(undefined, 'bold');
      doc.text('ADELANTOS', margin, y); y += 5;
      adelantos.forEach(g => {
        doc.setFontSize(8.5); doc.setTextColor(80, 80, 80); doc.setFont(undefined, 'normal');
        const dateStr = g.date ? format(parseISO(g.date), 'dd/MM/yyyy') : '—';
        doc.text(`  ${dateStr}  ${g.descripcion || 'Adelanto'}`, margin, y);
        doc.text(`- ${(g.importe || 0).toFixed(2)} €`, 180, y, { align: 'right' });
        y += 5;
      });
    }
    y += 4;
    doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.5); doc.line(margin, y, 196, y); y += 7;
    doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.setFont(undefined, 'normal');
    doc.text(`Total gastos:`, margin, y); doc.text(`${totalGastos.toFixed(2)} €`, 196, y, { align: 'right' }); y += 6;
    if (adelantos.length) {
      doc.text(`Total adelantos:`, margin, y); doc.text(`- ${totalAdelantos.toFixed(2)} €`, 196, y, { align: 'right' }); y += 6;
      doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(249, 115, 22);
      doc.text(`SALDO A LIQUIDAR:`, margin, y); doc.text(`${saldo.toFixed(2)} €`, 196, y, { align: 'right' });
    } else {
      doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(249, 115, 22);
      doc.text(`TOTAL:`, margin, y); doc.text(`${total.toFixed(2)} €`, 196, y, { align: 'right' });
    }
    doc.save(`nota-gastos-${nota.operario_name?.replace(/\s/g, '-')}-${nota.fecha_inicio || ''}.pdf`);
  };

  return (
    <>
      <Card className={`overflow-hidden transition-all ${isCerrada ? 'opacity-80' : ''}`}>
        <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(e => !e)}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCerrada ? 'bg-slate-100' : 'bg-primary/10'}`}>
            {isCerrada ? <Lock className="w-5 h-5 text-slate-500" /> : <Unlock className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{nota.titulo || 'Nota de gastos'}</span>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${isCerrada ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {isCerrada ? 'Cerrada' : 'Abierta'}
              </Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">{gastosNormales.length} gasto{gastosNormales.length !== 1 ? 's' : ''}</Badge>
              {adelantos.length > 0 && (
                <Badge variant="outline" className="text-[10px] shrink-0 bg-red-50 text-red-600 border-red-200">{adelantos.length} adelanto{adelantos.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {nota.operario_name} · {nota.fecha_inicio ? format(parseISO(nota.fecha_inicio), 'd MMM yyyy', { locale: es }) : ''}
              {nota.fecha_cierre ? ` → ${format(parseISO(nota.fecha_cierre), 'd MMM yyyy', { locale: es })}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{totalGastos.toFixed(2)} €</p>
              {adelantos.length > 0 && <p className="text-xs text-muted-foreground">Saldo: {saldo.toFixed(2)} €</p>}
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border flex-wrap">
              {!isCerrada && (
               <>
                 <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddGastoOpen(true)}>
                   <Plus className="w-3.5 h-3.5" /> Añadir gasto
                 </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-red-700 border-red-300 hover:bg-red-50" onClick={() => setAddAdelantoOpen(true)}>
                    <Wallet className="w-3.5 h-3.5" /> Adelanto
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={downloadPDF}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
              {!isCerrada ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50">
                      <Lock className="w-3.5 h-3.5" /> Cerrar nota
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar esta nota de gastos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Total gastos: <strong>{totalGastos.toFixed(2)} €</strong>
                        {adelantos.length > 0 && <> · Adelantos: <strong>- {totalAdelantos.toFixed(2)} €</strong> · Saldo: <strong>{saldo.toFixed(2)} €</strong></>}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cerrarNotaM.mutate()} className="bg-amber-600 hover:bg-amber-700 text-white">Cerrar nota</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : canSeeAll ? (
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => reabrirNotaM.mutate()}>
                  <Unlock className="w-3.5 h-3.5" /> Reabrir
                </Button>
              ) : null}
              {canSeeAll && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar nota de gastos?</AlertDialogTitle>
                      <AlertDialogDescription>Se eliminarán todos los gastos asociados ({gastos.length}). Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteNotaM.mutate()} className="bg-destructive text-destructive-foreground">Eliminar todo</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {isCerrada && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">Nota cerrada — no se pueden añadir más gastos.</p>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mx-4 mt-3 mb-0">
                <TabsTrigger value="gastos" className="text-xs">🧾 Gastos ({gastosNormales.length})</TabsTrigger>
                <TabsTrigger value="adelantos" className="text-xs">💰 Adelantos ({adelantos.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="gastos" className="mt-0">
                {gastosNormales.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay gastos en esta nota
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {CATEGORIAS.map(cat => {
                      const items = gastosPorCategoria[cat.key];
                      if (!items?.length) return null;
                      const Icon = cat.icon;
                      const subtotal = items.reduce((s, g) => s + (g.importe || 0), 0);
                      return (
                        <div key={cat.key}>
                          <div className={`flex items-center justify-between px-4 py-2 ${cat.color} bg-opacity-30`}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold">{cat.label}</span>
                              <span className="text-xs opacity-70">({items.length})</span>
                            </div>
                            <span className="text-xs font-semibold">{subtotal.toFixed(2)} €</span>
                          </div>
                          {items.map(g => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                              {g.ticket_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(g.ticket_url) ? (
                                <img src={g.ticket_url} alt="ticket" className="w-9 h-9 rounded-lg object-cover cursor-pointer shrink-0 border border-border" onClick={() => setTicketPreview(g.ticket_url)} />
                              ) : g.ticket_url ? (
                                <a href={g.ticket_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-blue-500" />
                                </a>
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{g.descripcion || g.proveedor || '—'}</p>
                                <p className="text-xs text-muted-foreground">{g.date ? format(parseISO(g.date), 'd MMM', { locale: es }) : ''}{g.proveedor && g.descripcion ? ` · ${g.proveedor}` : ''}</p>
                              </div>
                              <span className="font-bold text-primary shrink-0 text-sm">{(g.importe || 0).toFixed(2)} €</span>
                              {!isCerrada && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteGastoM.mutate(g)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                {gastosNormales.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-t border-border">
                    <span className="text-sm font-semibold text-muted-foreground">Total gastos</span>
                    <span className="text-xl font-bold text-primary">{totalGastos.toFixed(2)} €</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="adelantos" className="mt-0">
                {adelantos.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay adelantos registrados
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {adelantos.map(g => (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{g.descripcion || 'Adelanto'}</p>
                          <p className="text-xs text-muted-foreground">{g.date ? format(parseISO(g.date), 'd MMM yyyy', { locale: es }) : ''}</p>
                        </div>
                        <span className="font-bold text-red-600 shrink-0 text-sm">- {(g.importe || 0).toFixed(2)} €</span>
                        {!isCerrada && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar adelanto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteGastoM.mutate(g)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {adelantos.length > 0 && (
                  <div className="px-4 py-3 bg-muted/30 border-t border-border space-y-1">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Total gastos</span><span>{totalGastos.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Total adelantos</span><span>- {totalAdelantos.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between font-bold text-base text-primary border-t border-border pt-1 mt-1">
                      <span>Saldo a liquidar</span><span>{saldo.toFixed(2)} €</span>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Card>

      {ticketPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setTicketPreview(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-7 h-7" /></button>
          <img src={ticketPreview} alt="Ticket" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <AddGastoDialog 
        open={addGastoOpen} 
        onOpenChange={setAddGastoOpen}
        onSave={handleSaveGasto}
        nota={nota}
        myOperario={myOperario}
        isPending={createGastoM.isPending}
      />

      <AddAdelantoDialog 
        open={addAdelantoOpen} 
        onOpenChange={setAddAdelantoOpen}
        onSave={handleSaveAdelanto}
        isPending={createGastoM.isPending}
      />
    </>
  );
}