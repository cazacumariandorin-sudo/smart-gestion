import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { jsPDF } from 'jspdf';
import {
  Plus, Trash2, Receipt, Loader2, Save, Camera, X, ChevronDown, ChevronUp,
  Lock, Unlock, FileText, Fuel, ShoppingCart, Layers, Navigation, ParkingCircle, Wallet, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORIAS = [
  { key: 'combustible', label: 'Combustible', icon: Fuel, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'material', label: 'Material', icon: ShoppingCart, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'varios', label: 'Varios', icon: Layers, color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'peaje', label: 'Peaje', icon: Navigation, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'parking', label: 'Parking', icon: ParkingCircle, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'adelanto', label: 'Adelanto', icon: Wallet, color: 'bg-red-100 text-red-700 border-red-200' },
];
const catCfg = Object.fromEntries(CATEGORIAS.map(c => [c.key, c]));

const emptyGasto = {
  operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0],
  categoria: '', importe: '', descripcion: '', proveedor: '', ticket_url: '', project: '',
};

export default function NotaGastosCard({ nota, gastos, operarios, canSeeAll, myOperario, user }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [addGastoOpen, setAddGastoOpen] = useState(false);
  const [form, setForm] = useState(emptyGasto);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ticketPreview, setTicketPreview] = useState(null);

  const isCerrada = nota.estado === 'cerrada';
  const total = gastos.reduce((s, g) => s + (g.importe || 0), 0);

  const createGastoM = useMutation({
    mutationFn: d => base44.entities.GastoOperario.create(d),
    onSuccess: async () => {
      // Update nota total
      const newTotal = total + (parseFloat(form.importe) || 0);
      await base44.entities.NotaGastos.update(nota.id, { total: newTotal });
      qc.invalidateQueries({ queryKey: ['gastos_operarios'] });
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
      setAddGastoOpen(false);
      setForm(emptyGasto);
    }
  });

  const deleteGastoM = useMutation({
    mutationFn: async (g) => {
      await base44.entities.GastoOperario.delete(g.id);
      const newTotal = Math.max(0, total - (g.importe || 0));
      await base44.entities.NotaGastos.update(nota.id, { total: newTotal });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos_operarios'] });
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
    }
  });

  const cerrarNotaM = useMutation({
    mutationFn: () => base44.entities.NotaGastos.update(nota.id, {
      estado: 'cerrada',
      fecha_cierre: new Date().toISOString().split('T')[0],
      total,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas_gastos'] })
  });

  const reabrirNotaM = useMutation({
    mutationFn: () => base44.entities.NotaGastos.update(nota.id, { estado: 'abierta', fecha_cierre: '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas_gastos'] })
  });

  const deleteNotaM = useMutation({
    mutationFn: async () => {
      await Promise.all(gastos.map(g => base44.entities.GastoOperario.delete(g.id)));
      await base44.entities.NotaGastos.delete(nota.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
      qc.invalidateQueries({ queryKey: ['gastos_operarios'] });
    }
  });

  const openAddGasto = () => {
    const preFilled = myOperario
      ? { ...emptyGasto, operario_id: myOperario.id, operario_name: myOperario.name }
      : { ...emptyGasto, operario_id: nota.operario_id, operario_name: nota.operario_name };
    setForm(preFilled);
    setAddGastoOpen(true);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleTicketUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('ticket_url', file_url);
    setUploading(false);

    setOcrLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este ticket o factura y extrae la información. Devuelve un JSON con estos campos:
- importe: número con el total a pagar (solo el número, sin símbolo)
- proveedor: nombre del establecimiento o empresa
- fecha: fecha en formato YYYY-MM-DD (si aparece)
- descripcion: descripción breve del concepto o artículos
- categoria: una de estas opciones según el tipo de gasto: combustible, material, varios, peaje, parking, adelanto

Si no puedes extraer algún campo, ponlo como null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          importe: { type: 'number' },
          proveedor: { type: 'string' },
          fecha: { type: 'string' },
          descripcion: { type: 'string' },
          categoria: { type: 'string' },
        }
      }
    });

    setForm(p => ({
      ...p,
      ticket_url: file_url,
      importe: res.importe || p.importe,
      proveedor: res.proveedor || p.proveedor,
      date: res.fecha || p.date,
      descripcion: res.descripcion || p.descripcion,
      categoria: res.categoria && CATEGORIAS.find(c => c.key === res.categoria) ? res.categoria : p.categoria,
    }));
    setOcrLoading(false);
  };

  const handleSaveGasto = () => {
    createGastoM.mutate({
      ...form,
      nota_id: nota.id,
      importe: parseFloat(form.importe) || 0,
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFontSize(16); doc.setTextColor(40, 40, 40);
    doc.text('Nota de Gastos', margin, y); y += 8;
    doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    doc.text(nota.titulo || `Nota ${nota.operario_name}`, margin, y); y += 6;
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text(`Operario: ${nota.operario_name}`, margin, y); y += 5;
    doc.text(`Fecha inicio: ${nota.fecha_inicio ? format(parseISO(nota.fecha_inicio), 'dd/MM/yyyy') : ''}`, margin, y); y += 5;
    if (nota.fecha_cierre) {
      doc.text(`Fecha cierre: ${format(parseISO(nota.fecha_cierre), 'dd/MM/yyyy')}`, margin, y); y += 5;
    }
    doc.text(`Estado: ${nota.estado === 'cerrada' ? 'Cerrada' : 'Abierta'}`, margin, y); y += 5;
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, 196, y); y += 8;

    gastos.forEach(g => {
      if (y > 270) { doc.addPage(); y = 20; }
      const cat = catCfg[g.categoria];
      doc.setFontSize(9); doc.setTextColor(60, 60, 60);
      doc.text(`${g.date || ''}  [${cat?.label || g.categoria}]  ${g.descripcion || g.proveedor || ''}  ${(g.importe || 0).toFixed(2)} €`, margin, y);
      y += 5;
    });

    y += 4;
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, 196, y); y += 6;
    doc.setFontSize(12); doc.setTextColor(40, 40, 40); doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: ${total.toFixed(2)} €`, margin, y);

    doc.save(`nota-gastos-${nota.operario_name}-${nota.fecha_inicio || ''}.pdf`);
  };

  return (
    <>
      <Card className={`overflow-hidden transition-all ${isCerrada ? 'opacity-80' : ''}`}>
        {/* Header row */}
        <div
          className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCerrada ? 'bg-slate-100' : 'bg-primary/10'}`}>
            {isCerrada ? <Lock className="w-5 h-5 text-slate-500" /> : <Unlock className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{nota.titulo || `Nota de gastos`}</span>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${isCerrada ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {isCerrada ? 'Cerrada' : 'Abierta'}
              </Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">{gastos.length} gasto{gastos.length !== 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {nota.operario_name} · {nota.fecha_inicio ? format(parseISO(nota.fecha_inicio), 'd MMM yyyy', { locale: es }) : ''}
              {nota.fecha_cierre ? ` → ${format(parseISO(nota.fecha_cierre), 'd MMM yyyy', { locale: es })}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-bold text-primary">{total.toFixed(2)} €</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border">
            {/* Actions bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border flex-wrap">
              {!isCerrada && (
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAddGasto}>
                  <Plus className="w-3.5 h-3.5" /> Añadir gasto
                </Button>
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
                        Una vez cerrada no se podrán añadir más gastos. El total quedará fijado en <strong>{total.toFixed(2)} €</strong>.
                        Podrás reabrirla si es necesario.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cerrarNotaM.mutate()} className="bg-amber-600 hover:bg-amber-700 text-white">
                        Cerrar nota
                      </AlertDialogAction>
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
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar nota
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar nota de gastos?</AlertDialogTitle>
                      <AlertDialogDescription>Se eliminarán también todos los gastos asociados ({gastos.length}). Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteNotaM.mutate()} className="bg-destructive text-destructive-foreground">Eliminar todo</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Gastos list */}
            {isCerrada && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">Nota cerrada — no se pueden añadir más gastos. Crea una nueva nota para registrar nuevos gastos.</p>
              </div>
            )}

            <div className="divide-y divide-border">
              {gastos.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No hay gastos en esta nota
                </div>
              ) : (
                gastos.map(g => {
                  const cat = catCfg[g.categoria];
                  const Icon = cat?.icon || Receipt;
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                      {g.ticket_url ? (
                        <img
                          src={g.ticket_url}
                          alt="ticket"
                          className="w-10 h-10 rounded-lg object-cover cursor-pointer shrink-0"
                          onClick={() => setTicketPreview(g.ticket_url)}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {cat && <Badge variant="outline" className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>}
                          <span className="text-xs text-muted-foreground">{g.date ? format(parseISO(g.date), 'd MMM', { locale: es }) : ''}</span>
                        </div>
                        <p className="text-sm truncate">{g.descripcion || g.proveedor || '—'}</p>
                      </div>
                      <span className="font-bold text-primary shrink-0">{(g.importe || 0).toFixed(2)} €</span>
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
                  );
                })
              )}
            </div>

            {/* Total footer */}
            {gastos.length > 0 && (
              <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-t border-border">
                <span className="text-sm font-semibold text-muted-foreground">Total nota</span>
                <span className="text-xl font-bold text-primary">{total.toFixed(2)} €</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Ticket lightbox */}
      {ticketPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setTicketPreview(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-7 h-7" /></button>
          <img src={ticketPreview} alt="Ticket" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Add gasto dialog */}
      <Dialog open={addGastoOpen} onOpenChange={setAddGastoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Añadir Gasto
              <span className="text-sm font-normal text-muted-foreground ml-1">— {nota.titulo || nota.operario_name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Ticket upload + OCR */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2"><Camera className="w-3.5 h-3.5 text-primary" /> Foto ticket / factura (OCR automático)</Label>
              {form.ticket_url ? (
                <div className="relative">
                  <img src={form.ticket_url} alt="ticket" className="w-full h-40 object-cover rounded-lg" />
                  <button onClick={() => set('ticket_url', '')} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg gap-2">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                      <p className="text-white text-xs">Analizando ticket con IA...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                  <p className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Subir foto de ticket o factura'}</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleTicketUpload(e.target.files[0])} />
            </div>

            {ocrLoading && (
              <div className="flex items-center gap-2 text-xs text-primary bg-accent/50 rounded-lg px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo datos del ticket con IA...
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría *</Label>
                <MobileSelect value={form.categoria} onValueChange={v => set('categoria', v)} placeholder="Categoría...">
                  {CATEGORIAS.map(c => <MobileSelectItem key={c.key} value={c.key}>{c.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Importe (€) *</Label>
                <Input type="number" min="0" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Proveedor</Label>
                <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre establecimiento" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Descripción / Concepto</Label>
                <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Detalle del gasto..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGastoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGasto} disabled={!form.categoria || !form.importe || createGastoM.isPending} className="gap-2 min-w-28">
              {createGastoM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}