/**
 * TicketCapture v4 — captura y OCR+IA en un solo paso.
 * Llama directamente a procesarOcrNota con file_base64.
 * No depende de URLs de Drive ni cadenas frágiles.
 * onDone({ ocrDatos, ocr_raw, needs_manual, preview, archivo, cdn_url })
 */
import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const isMobile = () => 'ontouchstart' in window || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TicketCapture({ onDone, onSkip }) {
  const [fase, setFase] = useState('idle'); // idle | subiendo | ocr | ok | sin_ocr | error | webcam
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const procesarArchivo = useCallback(async (file) => {
    setFase('subiendo');
    setMensaje('Preparando archivo…');
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      // Convertir a base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => res(r.result);
        r.onerror = rej;
      });

      const archivo = {
        nombre: file.name,
        tipo: file.type,
        fecha_subida: new Date().toISOString(),
        storage: 'procesando',
      };

      // Subida a Drive en background (no bloquea OCR)
      const yyyy = new Date().getFullYear();
      const mm = String(new Date().getMonth() + 1).padStart(2, '0');
      base44.functions.invoke('subirArchivoConFallback', {
        file_base64: base64,
        ruta_drive: `Notas_Gastos/${yyyy}/${mm}`,
        nombre: file.name,
        entidad_tipo: 'RegistroGasto',
        entidad_id: null,
      }).then(res => {
        archivo.url = res.data?.file_url || base64;
        archivo.storage = res.data?.storage || 'base44_only';
        archivo.drive_file_id = res.data?.drive_file_id || null;
        archivo.cdn_url = res.data?.cdn_url_para_llm || null;
      }).catch(() => {
        archivo.url = base64;
        archivo.storage = 'local_only';
      });

      // OCR + IA directamente con base64 (no espera Drive)
      setFase('ocr');
      setMensaje('Leyendo documento (OCR + IA)…');

      const res = await base44.functions.invoke('procesarOcrNota', {
        file_base64: base64,
      });

      const resultado = res.data;

      if (resultado?.success && resultado?.datos) {
        setFase('ok');
        setMensaje(`Datos extraídos ✓ — confianza ${resultado.datos.confianza || 'media'}`);
        onDone({
          ocrDatos: resultado.datos,
          ocr_raw: resultado.ocr_raw || '',
          needs_manual: false,
          preview: previewUrl,
          archivo,
          cdn_url: resultado.cdn_url,
        });
      } else if (resultado?.ocr_raw && !resultado?.ia_ok) {
        // OCR ok pero IA falló
        setFase('sin_ocr');
        setMensaje('OCR completado — revisa los datos manualmente');
        onDone({
          ocrDatos: null,
          ocr_raw: resultado.ocr_raw,
          needs_manual: true,
          preview: previewUrl,
          archivo,
          cdn_url: resultado.cdn_url,
        });
      } else {
        // Todo falló
        setFase('sin_ocr');
        setMensaje('No se pudo leer el documento — introduce los datos manualmente');
        onDone({
          ocrDatos: null,
          ocr_raw: '',
          needs_manual: true,
          preview: previewUrl,
          archivo,
          cdn_url: null,
        });
      }
    } catch (e) {
      setFase('error');
      setMensaje('Error al procesar: ' + (e.message || ''));
    }
  }, [onDone]);

  const startWebcam = async () => {
    setFase('webcam');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setFase('error'); setMensaje('No se pudo acceder a la cámara'); }
  };

  const captureFrame = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream?.getTracks().forEach(t => t.stop()); setStream(null);
    canvas.toBlob(blob => {
      if (blob) procesarArchivo(new File([blob], 'foto-ticket.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  const stopWebcam = () => { stream?.getTracks().forEach(t => t.stop()); setStream(null); setFase('idle'); };
  const reset = () => { setFase('idle'); setMensaje(''); setPreview(null); stream?.getTracks().forEach(t => t.stop()); setStream(null); };

  // Webcam view
  if (fase === 'webcam') {
    return (
      <div className="space-y-3">
        <div className="relative w-full rounded-xl border bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full aspect-[4/3] object-cover" />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-4/5 h-3/4 border-2 border-white/60 rounded-xl relative">
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            Encuadra el ticket dentro del marco
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button onClick={captureFrame} className="flex-1 gap-2"><Camera className="w-4 h-4" /> Capturar foto</Button>
          <Button variant="outline" onClick={stopWebcam}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // Procesando
  if (fase === 'subiendo' || fase === 'ocr') {
    const pasos = [
      { key: 'subiendo', label: 'Preparando archivo', done: fase === 'ocr' },
      { key: 'ocr', label: 'Analizando con OCR + IA', done: false, active: fase === 'ocr' },
    ];
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        {preview && <img src={preview} alt="ticket" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <div className="w-full space-y-2">
          {pasos.map(p => (
            <div key={p.key} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm', p.done ? 'text-emerald-600' : p.active ? 'text-primary font-medium bg-primary/5' : 'text-muted-foreground')}>
              {p.done ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : p.active ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />}
              {p.label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{mensaje}</p>
      </div>
    );
  }

  // Completado con éxito
  if (fase === 'ok') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {preview && <img src={preview} alt="ticket" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{mensaje}</span>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Cambiar imagen
        </Button>
      </div>
    );
  }

  // Sin OCR / datos manuales
  if (fase === 'sin_ocr') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {preview && <img src={preview} alt="ticket" className="w-24 h-24 object-cover rounded-xl border shadow-sm" />}
        <div className="w-full p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{mensaje}</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Continúa al formulario para introducir los datos del ticket.</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Volver a intentar
        </Button>
      </div>
    );
  }

  // Error
  if (fase === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 text-center">{mensaje}</p>
        <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
      </div>
    );
  }

  // Idle — selector de origen
  const mobile = isMobile();
  return (
    <div className="space-y-3">
      <p className="text-xs text-center text-muted-foreground font-medium">
        Fotografía el ticket o sube el documento (JPEG, PNG, PDF)
      </p>
      {mobile ? (
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="tc-cam" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
            <Camera className="w-7 h-7 text-primary" />
            <span className="text-xs font-semibold text-primary">Hacer foto</span>
          </label>
          <input id="tc-cam" type="file" accept="image/*" capture="environment" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
          <label htmlFor="tc-gal" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer">
            <Image className="w-7 h-7 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Galería / Archivo</span>
          </label>
          <input id="tc-gal" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={startWebcam} className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
            <Camera className="w-7 h-7 text-primary" />
            <span className="text-xs font-semibold text-primary">Webcam</span>
          </button>
          <canvas ref={canvasRef} className="hidden" />
          <label htmlFor="tc-up" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer">
            <Upload className="w-7 h-7 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Subir archivo</span>
          </label>
          <input id="tc-up" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
        <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
      </Button>
    </div>
  );
}