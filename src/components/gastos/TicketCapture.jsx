import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function TicketCapture({ onDone, onSkip }) {
  const [estado, setEstado] = useState('idle'); // idle | loading | ok | error
  const [preview, setPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const procesar = async (file) => {
    if (!file) return;
    setEstado('loading');
    setPreview(URL.createObjectURL(file));
    setErrorMsg('');

    try {
      // Paso 1: leer como base64 (igual que Drawings.jsx y Manuales.jsx)
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      });

      // Paso 2: subir a CDN Base44 (patrón idéntico al de Drawings.jsx)
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileData });

      if (!file_url) throw new Error('Sin URL del servidor');

      // Paso 3: OCR + IA con la CDN URL
      const res = await base44.functions.invoke('procesarOcrNota', { cdn_url: file_url });
      const r = res?.data;

      setEstado('ok');
      onDone({
        cdn_url: file_url,
        archivo: { url: file_url, nombre: file.name, tipo: file.type, storage: 'base44_cdn' },
        preview: URL.createObjectURL(file),
        ocrDatos: r?.datos || null,
        ocr_raw: r?.ocr_raw || '',
        needs_manual: !r?.success || !r?.datos,
      });

    } catch (err) {
      // Cualquier error → formulario manual (nunca bloquear al usuario)
      setEstado('ok');
      onDone({
        cdn_url: null,
        archivo: { url: null, nombre: file?.name || 'ticket', tipo: file?.type || 'image/jpeg', storage: 'error' },
        preview: preview,
        ocrDatos: null,
        ocr_raw: '',
        needs_manual: true,
      });
    }
  };

  const reset = () => { setEstado('idle'); setPreview(null); setErrorMsg(''); };

  if (estado === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {preview && <img src={preview} alt="" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Procesando ticket con OCR + IA…</p>
      </div>
    );
  }

  if (estado === 'ok') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        {preview && <img src={preview} alt="" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Ticket procesado</span>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Cambiar imagen
        </Button>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-center text-muted-foreground">
          No se pudo procesar el ticket.<br />Puedes continuar e introducir los datos manualmente.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
          <Button size="sm" onClick={() => onDone({ cdn_url: null, archivo: null, preview, ocrDatos: null, ocr_raw: '', needs_manual: true })}>
            Continuar manual
          </Button>
        </div>
      </div>
    );
  }

  // idle
  const isMobile = 'ontouchstart' in window;
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-center text-muted-foreground">
        Fotografía o sube el ticket / factura
      </p>

      {isMobile ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-primary">Hacer foto</span>
            <input type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ''; }} />
          </label>
          <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Subir archivo</span>
            <input type="file" accept="image/*,.pdf" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ''; }} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
          <Upload className="w-10 h-10 text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-primary">Selecciona o arrastra el ticket</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, PDF</p>
          </div>
          <input type="file" accept="image/*,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ''; }} />
        </label>
      )}

      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
        <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
      </Button>
    </div>
  );
}