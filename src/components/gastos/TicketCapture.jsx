import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, RotateCcw, Image, Loader2, CheckCircle2, AlertCircle, Aperture } from 'lucide-react';
import { cn } from '@/lib/utils';

const isMobile = () => 'ontouchstart' in window || /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * TicketCapture
 * Props:
 *   onCapturado(archivo, previewUrl, datosOcr) — llamado cuando imagen lista (con o sin OCR)
 *   onSaltar() — usuario quiere continuar sin imagen
 */
export default function TicketCapture({ onCapturado, onSaltar }) {
  const [modo, setModo] = useState(null); // null | 'webcam' | 'procesando'
  const [preview, setPreview] = useState(null);
  const [estado, setEstado] = useState('idle'); // idle | uploading | ocr | ok | error
  const [mensaje, setMensaje] = useState('');
  const [streamActivo, setStreamActivo] = useState(false);

  const inputRefFoto = useRef(null);
  const inputRefGaleria = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const mobile = isMobile();

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const iniciarWebcam = async () => {
    setModo('webcam');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActivo(true);
      }
    } catch {
      setEstado('error');
      setMensaje('No se pudo acceder a la cámara');
      setModo(null);
    }
  };

  const capturarFotoWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `ticket_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      // Parar stream
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStreamActivo(false);
      setModo(null);
      procesarArchivo(file, url);
    }, 'image/jpeg', 0.9);
  };

  const procesarArchivo = async (file, previewUrl) => {
    const url = previewUrl || URL.createObjectURL(file);
    setPreview(url);
    setEstado('uploading');
    setMensaje('Subiendo imagen...');

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setEstado('ocr');
      setMensaje('Extrayendo datos con IA...');

      let datosOcr = null;
      try {
        const res = await base44.functions.invoke('procesarOcrNota', { file_url, file_tipo: file.type });
        if (res.data?.success && res.data?.datos) {
          datosOcr = res.data.datos;
        }
      } catch {
        // OCR falló pero archivo OK — continuar
      }

      const archivo = { url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString() };
      setEstado('ok');
      setMensaje(datosOcr ? `Datos extraídos (confianza: ${datosOcr.confianza || 'media'})` : 'Imagen subida (sin extracción automática)');
      onCapturado(archivo, url, datosOcr);
    } catch (e) {
      setEstado('error');
      setMensaje('Error al subir: ' + e.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
    e.target.value = '';
  };

  const reiniciar = () => {
    setPreview(null);
    setEstado('idle');
    setMensaje('');
    setModo(null);
    setStreamActivo(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  // Vista previa con resultado
  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-52 flex items-center justify-center">
          <img src={preview} alt="Ticket" className="max-h-52 w-auto object-contain" />
          <button
            onClick={reiniciar}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        {estado === 'uploading' || estado === 'ocr' ? (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />{mensaje}
          </div>
        ) : estado === 'ok' ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" />{mensaje}
          </div>
        ) : estado === 'error' ? (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />{mensaje}
          </div>
        ) : null}
      </div>
    );
  }

  // Modo webcam
  if (modo === 'webcam') {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {!streamActivo && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setModo(null); setStreamActivo(false); }} className="flex-1">
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={capturarFotoWebcam} disabled={!streamActivo} className="flex-1 gap-2">
            <Aperture className="w-4 h-4" /> Capturar foto
          </Button>
        </div>
      </div>
    );
  }

  // Pantalla de selección inicial
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-center">📷 Añadir imagen del ticket</p>
      <p className="text-xs text-muted-foreground text-center">Los datos se extraerán automáticamente</p>

      {/* Inputs ocultos */}
      <input ref={inputRefFoto} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
      <input ref={inputRefGaleria} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />

      {mobile ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => inputRefFoto.current?.click()}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium">Hacer foto</span>
            <span className="text-xs text-muted-foreground">Cámara directa</span>
          </button>
          <button
            onClick={() => inputRefGaleria.current?.click()}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Image className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium">Desde galería</span>
            <span className="text-xs text-muted-foreground">Subir imagen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={iniciarWebcam}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium">Webcam</span>
            <span className="text-xs text-muted-foreground">Capturar en vivo</span>
          </button>
          <button
            onClick={() => inputRefGaleria.current?.click()}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium">Subir archivo</span>
            <span className="text-xs text-muted-foreground">Imagen o PDF</span>
          </button>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onSaltar} className="w-full text-muted-foreground">
        Saltar — continuar sin imagen
      </Button>
    </div>
  );
}