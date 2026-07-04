import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, SkipForward, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';

/** Comprime imagen a max 800px ancho/alto, calidad JPEG 60%. Resultado: ~80-120KB. */
async function comprimirParaOcr(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const original = e.target.result;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 800;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(original); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.60);
          resolve(compressed);
        } catch {
          resolve(original);
        }
      };
      img.onerror = () => resolve(original);
      img.src = original;
    };
    reader.onerror = () => resolve(null);
  });
}

export default function TicketCapture({ onDone, onSkip }) {
  const [estado, setEstado] = useState('idle');
  const [preview, setPreview] = useState(null);

  const procesar = async (file) => {
    if (!file) return;
    setEstado('loading');
    setPreview(URL.createObjectURL(file));

    try {
      // 1. Comprimir imagen (800px, 60% calidad → ~80-120KB)
      const base64 = await comprimirParaOcr(file);
      if (!base64) throw new Error('No se pudo leer el archivo');

      // 2. Enviar base64 al backend para OCR+IA
      //    El backend sube a CDN internamente y usa esa URL con InvokeLLM
      const res = await base44.functions.invoke('procesarOcrNota', {
        file_base64: base64,
        file_nombre: file.name,
        file_tipo: file.type,
      });

      const r = res?.data;

      // Siempre avanzar al formulario (con o sin datos OCR)
      setEstado('ok');
      onDone({
        cdn_url: r?.cdn_url || null,
        archivo: {
          url: r?.cdn_url || null,
          nombre: file.name,
          tipo: file.type,
          storage: r?.cdn_url ? 'base44_cdn' : 'local',
        },
        preview: URL.createObjectURL(file),
        ocrDatos: r?.datos || null,
        ocr_raw: r?.ocr_raw || '',
        needs_manual: !r?.success || !r?.datos,
        debug_error: r?.error || null,
      });

    } catch {
      // Cualquier error → formulario manual
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

  const reset = () => { setEstado('idle'); setPreview(null); };

  if (estado === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {preview && <img src={preview} alt="" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground text-center">
          Comprimiendo y analizando ticket…<br/>
          <span className="text-xs opacity-60">OCR + IA (puede tardar 10-15 seg.)</span>
        </p>
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

  const isMobile = 'ontouchstart' in window;
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-center text-muted-foreground">Fotografía o sube el ticket / factura</p>
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