import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Loader2, Save, Camera, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const CONCEPTOS = [
  { value: 'gasolina', label: '⛽ Gasolina' },
  { value: 'parking', label: '🅿️ Parking' },
  { value: 'material', label: '📦 Material' },
  { value: 'peaje', label: '🛣️ Peaje' },
  { value: 'otro', label: '📌 Otro' },
];

const emptyForm = {
  titulo: '',
  fecha: new Date().toISOString().split('T')[0],
  concepto: 'otro',
  importe: '',
  cif: '',
  proveedor: '',
  direccion: '',
  codigo_postal: '',
  descripcion: '',
  notas: '',
  archivos: [],
};

export default function CrearNotaGastos({ onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [preview, setPreview] = useState(null);

  const createM = useMutation({
    mutationFn: async (data) => {
      return base44.entities.NotaGastos.create({
        ...data,
        archivos: archivos,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
      toast.success('Nota de gastos creada');
      setForm(emptyForm);
      setArchivos([]);
      setOcrDone(false);
      onSuccess?.();
    },
    onError: () => toast.error('Error al crear la nota'),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFileUpload = async (file) => {
    setUploading(true);
    setOcrLoading(false);
    setOcrDone(false);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Guardar archivo
      const newFile = {
        nombre: file.name,
        url: file_url,
        tipo: file.type.startsWith('image/') ? 'foto' : 'documento',
        fecha_subida: new Date().toISOString(),
      };
      setArchivos(p => [...p, newFile]);
      setPreview(file_url);

      // Usar OCR para extraer datos
      setOcrLoading(true);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este ticket, factura o recibo de gasto y extrae los datos siguientes en formato JSON:
- fecha: fecha en formato YYYY-MM-DD (si aparece)
- importe: número del total a pagar (solo número sin símbolo €)
- cif: CIF o NIF del proveedor
- proveedor: nombre de la empresa o establecimiento
- direccion: dirección del proveedor
- codigo_postal: código postal
- descripcion: descripción breve de qué se compró

Si no encuentras un dato, ponlo como null.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            fecha: { type: 'string' },
            importe: { type: 'number' },
            cif: { type: 'string' },
            proveedor: { type: 'string' },
            direccion: { type: 'string' },
            codigo_postal: { type: 'string' },
            descripcion: { type: 'string' },
          },
        },
      });

      // Rellenar formulario con datos extraídos
      if (res.fecha) set('fecha', res.fecha);
      if (res.importe) set('importe', res.importe.toString());
      if (res.cif) set('cif', res.cif);
      if (res.proveedor) set('proveedor', res.proveedor);
      if (res.direccion) set('direccion', res.direccion);
      if (res.codigo_postal) set('codigo_postal', res.codigo_postal);
      if (res.descripcion) set('descripcion', res.descripcion);
      if (!form.titulo && res.proveedor) set('titulo', res.proveedor);

      setOcrDone(true);
      toast.success('Datos extraídos del documento');
    } catch (err) {
      toast.error('No se pudo extraer datos del archivo');
      console.error(err);
    } finally {
      setUploading(false);
      setOcrLoading(false);
    }
  };

  const handleSave = () => {
    if (!form.titulo || !form.concepto || !form.importe) {
      toast.error('Completa al menos título, concepto e importe');
      return;
    }
    createM.mutate({
      ...form,
      importe: parseFloat(form.importe) || 0,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6">Crear Nueva Nota de Gastos</h2>

        {/* Upload zona */}
        <div className="mb-6">
          <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" /> Foto o Documento (OCR automático)
          </Label>
          {preview ? (
            <div className="relative mb-4">
              {archivos[archivos.length - 1]?.tipo === 'foto' ? (
                <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-lg border border-border" />
              ) : (
                <div className="w-full h-40 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                  <p className="text-sm text-muted-foreground">📄 Documento cargado</p>
                </div>
              )}
              <button
                onClick={() => {
                  setPreview(null);
                  setArchivos(p => p.slice(0, -1));
                  setOcrDone(false);
                }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              {ocrLoading && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
                  <p className="text-white text-sm">Analizando...</p>
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
            <label className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:bg-primary/5 transition-colors block">
              {uploading || ocrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">{ocrLoading ? 'Extrayendo datos...' : 'Subiendo...'}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Foto o documento</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, PDF - OCR automático</p>
                </div>
              )}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Gasto de gasolina" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Concepto *</Label>
              <MobileSelect value={form.concepto} onValueChange={v => set('concepto', v)} placeholder="Concepto">
                {CONCEPTOS.map(c => <MobileSelectItem key={c.value} value={c.value}>{c.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Importe (€) *</Label>
              <Input type="number" min="0" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Proveedor</Label>
              <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre empresa..." />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">CIF/NIF</Label>
              <Input value={form.cif} onChange={e => set('cif', e.target.value)} placeholder="12345678A" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle..." />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Código Postal</Label>
              <Input value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} placeholder="28001" />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Qué se compró..." />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Notas adicionales</Label>
              <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>

          {archivos.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">📎 Archivos ({archivos.length})</p>
              <div className="space-y-1">
                {archivos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1">
                    <span>{f.tipo === 'foto' ? '📷' : '📄'} {f.nombre}</span>
                    <button onClick={() => setArchivos(p => p.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setForm(emptyForm)} className="flex-1">Limpiar</Button>
            <Button onClick={handleSave} disabled={createM.isPending} className="flex-1 gap-2">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar nota
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}