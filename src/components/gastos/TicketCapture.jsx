/**
 * TicketCapture — paso 1 del flujo de creación de registro de gasto.
 * Detecta si es móvil/tablet y ofrece opciones adaptadas.
 * En móvil: "Hacer foto" (cámara directa) y "Subir desde galería".
 * En escritorio: "Capturar con webcam" (getUserMedia) y "Subir archivo".
 * Tras captura/subida, llama a onDone({ file_url, archivo, ocrDatos }).
 */
import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const isMobile = () => 'ontouchstart' in window || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TicketCapture({ onDone, onSkip }) {
  const [estado, setEstado] = useState('idle'); // idle | uploading | ocr | ok | error | webcam
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);


  const procesarArchivo = useCallback(async (file) => {
    setEstado('uploading');
    setMensaje('Subiendo ticket...');
    setPreview(URL.createObjectURL(file));
    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      // Intentar subir a Google Drive; si falla, usar Data URL local
      let file_url = base64;
      let archivo = {
        url: base64,
        nombre: file.name,
        tipo: file.type,
        fecha_subida: new Date().toISOString(),
        storage: 'local',
      };

      try {
        const res = await base44.functions.invoke('uploadFileToGdrive', {
          file: base64,
          folder_path: 'Notas_Gastos',
        });
        file_url = res.data.file_url;
        archivo = {
          url: file_url,
          nombre: file.name,
          tipo: file.type,
          fecha_subida: new Date().toISOString(),
          storage: res.data.storage,
          drive_file_id: res.data.drive_file_id,
        };
      } catch { /* Drive no disponible — usar Data URL local */ }

      setEstado('ocr');
      setMensaje('Extrayendo datos con IA...');
      let ocrDatos = {};
      try {
        const ocrRes = await base44.functions.invoke('procesarOcrNota', { file_url, file_tipo: file.type });
        if (ocrRes.data?.success && ocrRes.data?.datos) ocrDatos = ocrRes.data.datos;
      } catch { /* OCR no disponible — continuar sin datos */ }

      setEstado('ok');
      setMensaje('Imagen procesada');
      onDone({ file_url, archivo, ocrDatos });
    } catch (e) {
      setEstado('error');
      setMensaje('Error al procesar el ticket: ' + (e.message || ''));
    }
  }, [onDone]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // ── WEBCAM ──
  const startWebcam = async () => {
    setEstado('webcam');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setEstado('error');
      setMensaje('No se pudo acceder a la cámara');
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    canvas.toBlob(blob => {
      if (blob) procesarArchivo(new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const stopWebcam = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setEstado('idle');
  };

  const reset = () => {
    setEstado('idle');
    setMensaje('');
    setPreview(null);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const mobile = isMobile();

  // ── WEBCAM VIEW ──
  if (estado === 'webcam') {
    return (
      <div className="space-y-3">
        <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border bg-black aspect-video object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button onClick={captureFrame} className="flex-1 gap-2">
            <Camera className="w-4 h-4" /> Capturar foto
          </Button>
          <Button variant="outline" onClick={stopWebcam}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // ── PROCESANDO ──
  if (estado === 'uploading' || estado === 'ocr') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-xl border shadow" />}
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-primary">{mensaje}</p>
      </div>
    );
  }

  // ── OK ──
  if (estado === 'ok') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-xl border shadow" />}
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{mensaje}</span>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Repetir captura
        </Button>
      </div>
    );
  }

  // ── ERROR ──
  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600">{mensaje}</p>
        <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
      </div>
    );
  }

  // ── IDLE ──
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-center text-muted-foreground">Captura el ticket o factura</p>

      {mobile ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Cámara directa — label nativo para compatibilidad iOS/Android dentro de Dialog */}
          <label
            htmlFor="ticket-camera-input"
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-xs font-semibold text-primary">Hacer foto</span>
          </label>
          <input id="ticket-camera-input" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />

          {/* Galería */}
          <label
            htmlFor="ticket-gallery-input"
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer"
          >
            <Image className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Galería</span>
          </label>
          <input id="ticket-gallery-input" type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Webcam */}
          <button
            onClick={startWebcam}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-xs font-semibold text-primary">Capturar con webcam</span>
          </button>
          <canvas ref={canvasRef} className="hidden" />

          {/* Subir archivo */}
          <label
            htmlFor="desktop-file-input"
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer"
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Subir archivo</span>
          </label>
          <input id="desktop-file-input" type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground">
        <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
      </Button>
    </div>
  );
}