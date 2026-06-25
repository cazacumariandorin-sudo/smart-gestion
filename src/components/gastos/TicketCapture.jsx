/**
 * TicketCapture — paso 1 del flujo de creación de registro de gasto.
 *
 * FLUJO OCR:
 * 1. Captura/subida de imagen (cámara, galería, webcam, archivo)
 * 2. Subida a Google Drive (si disponible)
 * 3. FASE 1 OCR: extracción de texto bruto del documento
 * 4. FASE 2 IA: análisis y estructuración de los datos OCR
 *
 * Si la IA (fase 2) no está disponible, se pasa ia_no_disponible: true
 * al formulario para que muestre el aviso y pida confirmación al usuario.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw, ScanLine, FileSearch, Brain, AlertTriangle } from 'lucide-react';

const isMobile = () => 'ontouchstart' in window || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TicketCapture({ onDone, onSkip }) {
  const [estado, setEstado] = useState('idle'); // idle | uploading | ocr | ia | ok | sin_ia | error | webcam
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [stream, setStream] = useState(null);
  const [permisoCamara, setPermisoCamara] = useState('indeterminado');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const checkPermiso = async () => {
      try {
        if (!navigator.permissions) { setPermisoCamara('indeterminado'); return; }
        const result = await navigator.permissions.query({ name: 'camera' });
        setPermisoCamara(result.state);
        result.onchange = () => setPermisoCamara(result.state);
      } catch { setPermisoCamara('indeterminado'); }
    };
    checkPermiso();
  }, []);

  const procesarArchivo = useCallback(async (file) => {
    setEstado('uploading');
    setMensaje('Subiendo ticket...');
    setPreview(URL.createObjectURL(file));
    try {
      // 1. Convertir a base64
      const base64 = await fileToBase64(file);
      let file_url = null;
      let driveOk = false;
      let archivo = {
        url: base64,
        nombre: file.name,
        tipo: file.type,
        fecha_subida: new Date().toISOString(),
        storage: 'local',
      };

      // 2. Subir a Drive
      try {
        const res = await base44.functions.invoke('uploadFileToGdrive', {
          file: base64,
          folder_path: 'Notas_Gastos',
        });
        file_url = res.data.file_url;
        driveOk = true;
        archivo = {
          url: file_url,
          nombre: file.name,
          tipo: file.type,
          fecha_subida: new Date().toISOString(),
          storage: res.data.storage,
          drive_file_id: res.data.drive_file_id,
        };
      } catch { /* Drive no disponible */ }

      // 3. OCR + IA (2 fases)
      let ocrDatos = {};
      let ia_no_disponible = false;
      let ocr_texto_bruto = '';

      if (driveOk && file_url) {
        setEstado('ocr');
        setMensaje('Leyendo documento (OCR)...');
        try {
          const ocrRes = await base44.functions.invoke('procesarOcrNota', {
            file_url,
            file_tipo: file.type,
          });
          const resultado = ocrRes.data;

          if (resultado?.ocr_disponible || resultado?.datos?.ocr_raw) {
            ocr_texto_bruto = resultado?.datos?.ocr_raw || '';
          }

          if (resultado?.ia_disponible && resultado?.datos) {
            setEstado('ia');
            setMensaje('Analizando con IA...');
            await new Promise(r => setTimeout(r, 600));
            ocrDatos = resultado.datos;
            ia_no_disponible = false;
          } else if (resultado?.ocr_disponible === false && !resultado?.ia_disponible) {
            ia_no_disponible = true;
          } else {
            ia_no_disponible = true;
            ocrDatos = resultado?.datos || {};
          }
        } catch {
          ia_no_disponible = true;
        }
      } else {
        ia_no_disponible = true;
      }

      if (ia_no_disponible) {
        setEstado('sin_ia');
        setMensaje('IA no disponible — revisa los datos manualmente');
      } else {
        setEstado('ok');
        setMensaje(`Datos extraídos (confianza: ${ocrDatos.confianza || 'media'})`);
      }

      onDone({
        file_url: file_url || base64,
        archivo,
        ocrDatos,
        ia_no_disponible,
        ocr_texto_bruto,
      });
    } catch (e) {
      setEstado('error');
      setMensaje('Error al procesar el ticket: ' + (e.message || ''));
    }
  }, [onDone]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // WEBCAM
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

  // WEBCAM VIEW
  if (estado === 'webcam') {
    return (
      <div className="space-y-3">
        <div className="relative w-full rounded-xl border bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/50 rounded-lg">
              <div className="absolute top-0 left-1/4 w-1/2 h-4 border-t-4 border-l-4 border-r-4 border-primary rounded-t-lg" />
              <div className="absolute bottom-0 left-1/4 w-1/2 h-4 border-b-4 border-l-4 border-r-4 border-primary rounded-b-lg" />
              <div className="absolute top-1/4 left-0 w-4 h-1/2 border-t-4 border-l-4 border-b-4 border-primary rounded-l-lg" />
              <div className="absolute top-1/4 right-0 w-4 h-1/2 border-t-4 border-r-4 border-b-4 border-primary rounded-r-lg" />
            </div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
              <ScanLine className="w-3 h-3" />
              Encuadra el documento dentro del marco
            </div>
          </div>
        </div>
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

  // PROCESANDO
  if (estado === 'uploading' || estado === 'ocr' || estado === 'ia') {
    const iconos = {
      uploading: <Loader2 className="w-8 h-8 text-primary animate-spin" />,
      ocr: <FileSearch className="w-8 h-8 text-blue-500 animate-pulse" />,
      ia: <Brain className="w-8 h-8 text-purple-500 animate-pulse" />,
    };
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-xl border shadow" />}
        {iconos[estado]}
        <p className="text-sm font-medium text-primary">{mensaje}</p>
        <div className="flex gap-1.5 text-xs text-muted-foreground">
          <span className={estado === 'uploading' ? 'font-bold text-primary' : 'opacity-40'}>① Subida</span>
          <span className="opacity-40">→</span>
          <span className={estado === 'ocr' ? 'font-bold text-blue-500' : 'opacity-40'}>② OCR</span>
          <span className="opacity-40">→</span>
          <span className={estado === 'ia' ? 'font-bold text-purple-500' : 'opacity-40'}>③ IA</span>
        </div>
      </div>
    );
  }

  // SIN IA
  if (estado === 'sin_ia') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-xl border shadow" />}
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">IA no disponible</span>
        </div>
        <p className="text-xs text-muted-foreground text-center px-4">
          El ticket se ha subido pero no se pudieron extraer datos automáticamente. Revisa y rellena los campos manualmente.
        </p>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </Button>
      </div>
    );
  }

  // OK
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

  // ERROR
  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600">{mensaje}</p>
        <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
      </div>
    );
  }

  // IDLE
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-center text-muted-foreground">Captura el ticket o factura</p>

      {permisoCamara === 'denegado' && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold mb-0.5">Permiso de cámara denegado</p>
            <p>Actívalo en los ajustes de tu navegador/dispositivo para poder escanear documentos.</p>
          </div>
        </div>
      )}

      {mobile ? (
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="ticket-camera-input" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-xs font-semibold text-primary">Hacer foto</span>
          </label>
          <input id="ticket-camera-input" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />

          <label htmlFor="ticket-gallery-input" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer">
            <Image className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Galería</span>
          </label>
          <input id="ticket-gallery-input" type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={startWebcam} className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-xs font-semibold text-primary">Capturar con webcam</span>
          </button>
          <canvas ref={canvasRef} className="hidden" />

          <label htmlFor="desktop-file-input" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer">
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