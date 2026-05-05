import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Save, Camera, X, FileText, ExternalLink, Wallet, Sparkles, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CATEGORIAS = [
  { key: 'combustible', label: 'Combustible' },
  { key: 'comida', label: 'Comida' },
  { key: 'material', label: 'Material' },
  { key: 'parking', label: 'Parking' },
  { key: 'peaje', label: 'Peaje' },
  { key: 'varios', label: 'Otros' },
];
const catCfg = Object.fromEntries(CATEGORIAS.map(c => [c.key, c]));

const emptyGasto = {
  operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0],
  categoria: '', importe: '', descripcion: '', proveedor: '', ticket_url: '', project: '',
};

export function AddGastoDialog({ open, onOpenChange, onSave, nota, myOperario, isPending }) {
  const [form, setForm] = useState(emptyGasto);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOcrUpload = async (file) => {
    setUploading(true);
    setOcrLoading(false);
    setOcrDone(false);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('ticket_url', file_url);
      setUploading(false);
      setOcrLoading(true);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este ticket o factura y extrae la información. Devuelve un JSON con:
- importe: número total (solo número, sin símbolo €)
- proveedor: nombre del establecimiento o empresa
- fecha: fecha en formato YYYY-MM-DD (si aparece, si no null)
- descripcion: descripción breve del concepto
- categoria: una de: combustible, comida, material, peaje, parking, varios (la más apropiada)
Si no puedes extraer un campo ponlo como null.`,
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
      const extracted = res?.data || res || {};
      setForm(p => ({
        ...p,
        ticket_url: file_url,
        importe: extracted.importe != null ? extracted.importe : p.importe,
        proveedor: extracted.proveedor || p.proveedor,
        date: extracted.fecha || p.date,
        descripcion: extracted.descripcion || p.descripcion,
        categoria: extracted.categoria && catCfg[extracted.categoria] ? extracted.categoria : p.categoria,
      }));
      setOcrDone(true);
      toast.success('Datos extraídos del ticket');
    } catch {
      toast.error('No se pudo extraer datos del ticket');
    }
    setUploading(false);
    setOcrLoading(false);
  };

  const handleClose = (v) => {
    onOpenChange(v);
    if (!v) {
      setOcrDone(false);
      setForm(emptyGasto);
    }
  };

  const handleSave = () => {
    if (!form.categoria || !form.importe || !form.descripcion) {
      toast.error('Rellena categoría, importe y descripción');
      return;
    }
    onSave({ ...form, importe: parseFloat(form.importe) || 0 });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Añadir Gasto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Foto / ticket (OCR automático)
            </Label>
            {form.ticket_url ? (
              <div className="relative">
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(form.ticket_url) ? (
                  <img src={form.ticket_url} alt="ticket" className="w-full h-40 object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-muted flex flex-col items-center justify-center gap-1 border border-border">
                    <FileText className="w-8 h-8 text-primary" />
                    <p className="text-xs text-muted-foreground">Archivo subido</p>
                    <a href={form.ticket_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> Ver archivo</a>
                  </div>
                )}
                <button onClick={() => { set('ticket_url', ''); setOcrDone(false); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                {ocrLoading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg gap-2">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <p className="text-white text-xs font-medium">Analizando con IA...</p>
                  </div>
                )}
                {ocrDone && !ocrLoading && (
                  <div className="absolute bottom-2 left-2 right-2 bg-emerald-600/90 text-white rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Datos extraídos automáticamente</span>
                  </div>
                )}
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg h-28 cursor-pointer transition-colors ${uploading || ocrLoading ? 'opacity-60 pointer-events-none' : 'hover:bg-muted/30'} border-primary/30`}>
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Camera className="w-7 h-7 text-muted-foreground" />}
                <p className="text-xs text-muted-foreground text-center">{uploading ? 'Subiendo...' : 'Foto de ticket / factura / PDF'}</p>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleOcrUpload(e.target.files[0])} />
              </label>
            )}
          </div>

          {ocrLoading && (
            <div className="flex items-center gap-2 text-xs text-primary bg-accent/50 rounded-lg px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo datos...
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
              <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Establecimiento" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Detalle..." />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.categoria || !form.importe || !form.descripcion || isPending} className="gap-2 min-w-28">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddAdelantoDialog({ open, onOpenChange, onSave, isPending }) {
  const [form, setForm] = useState({ importe: '', date: new Date().toISOString().split('T')[0], descripcion: '' });

  const handleClose = (v) => {
    onOpenChange(v);
    if (!v) setForm({ importe: '', date: new Date().toISOString().split('T')[0], descripcion: '' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-red-600" /> Registrar Adelanto
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Importe (€) *</Label>
            <Input type="number" min="0" step="0.01" value={form.importe} onChange={e => setForm(p => ({ ...p, importe: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Adelanto en efectivo..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={() => { onSave({ ...form, importe: parseFloat(form.importe) || 0 }); handleClose(false); }} disabled={!form.importe || isPending} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}