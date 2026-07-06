import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

async function comprimirImagen(file) {
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
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(original); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.60));
        } catch { resolve(original); }
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
  const [ocr_raw, setOcrRaw] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const procesar = async (file) => {
    if (!file) return;
    setEstado('loading');
    setPreview(URL.createObjectURL(file));
    setErrorMsg('');
    setOcrRaw('');

    try {
      const esImagen = file.type.startsWith('image/');
      const base64 = esImagen
        ? await comprimirImagen(file)
        : await new Promise((res, rej) => {
            const r = new FileReader(); r.readAsDataURL(file);
            r.onload = () => res(r.result); r.onerror = rej;
          });

      if (!base64) throw new Error('No se pudo leer el archivo');

      const res = await base44.functions.invoke('procesarOcrNota', {
        file_base64: base64,
        file_tipo: file.type,
      });

      const r = res?.data;
      const textoOcr = r?.ocr_raw || '';

      setOcrRaw(textoOcr);
      setEstado('ok');

      onDone({
        archivo: { url: null, nombre: file.name, tipo: file.type, storage: 'local' },
        preview: URL.createObjectURL(file),
        ocr_raw: textoOcr,
        ocr_ok: r?.success && textoOcr.length > 5,
        error_ocr: r?.error || null,
      });

    } catch (err) {
      setErrorMsg(String(err?.message || '').slice(0, 120));
      setEstado('error');
    }
  };

  const reset = () => { setEstado('idle'); setPreview(null); setOcrRaw(''); setErrorMsg(''); };

  if (estado === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {preview && <img src={preview} alt="" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Extrayendo texto del ticket (OCR)...</p>
      </div>
    );
  }

  if (estado === 'ok') {
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-3">
          {preview && <img src={preview} alt="" className="w-16 h-16 object-cover rounded-xl border shadow-sm shrink-0" />}
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              {ocr_raw.length > 5 ? 'Texto extraido - revisa el formulario' : 'Sin texto legible - introduce los datos manualmente'}
            </span>
          </div>
        </div>
        {ocr_raw.length > 5 && (
          <details className="w-full">
            <summary className="text-xs text-muted-foreground cursor-pointer">Ver texto OCR extraido</summary>
            <pre className="mt-1 text-[10px] bg-muted/50 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap border">{ocr_raw}</pre>
          </details>
        )}
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs self-center">
          <RefreshCw className="w-3.5 h-3.5" /> Cambiar imagen
        </Button>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-center text-muted-foreground">No se pudo leer el ticket.<br />Continua e introduce los datos manualmente.</p>
        {errorMsg && <p className="text-[10px] text-red-500 text-center max-w-xs">{errorMsg}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
          <Button size="sm" onClick={() => onDone({ archivo: null, preview, ocr_raw: '', ocr_ok: false, error_ocr: errorMsg })}>
            Continuar manual
          </Button>
        </div>
      </div>
    );
  }

  const isMobile = 'ontouchstart' in window;
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-center text-muted-foreground">Fotografía o sube el ticket / factura</p>
      <p className="text-[11px] text-center text-muted-foreground opacity-70">El sistema extrae el texto para ayudarte a rellenar el formulario</p>
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
        <SkipForward className="w-3.5 h-3.5" /> Saltar - rellenar manualmente
      </Button>
    </div>
  );
}