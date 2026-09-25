/**
 * MultaDocumentoOcr — Pipeline de captura + mejora + OCR para documentos de multa.
 *
 * Flujo (réplica del módulo Económico / TicketCapture):
 * 1. Captura/subida de foto.
 * 2. Detección de bordes + enderezado (DocumentEdgeCrop).
 * 3. Mejora de nitidez + auto-contraste (sharpenAndEnhance).
 * 4. Subida a CDN (Core.UploadPublicFile).
 * 5. OCR primario (InvokeLLM modelo por defecto).
 * 6. Si confianza baja → respaldo IA automático (gemini_3_flash).
 * 7. Devuelve { file_url, datos, confianza, precisa, precision_motivo } vía onComplete.
 *
 * tipo: 'volante' (aviso oficial) | 'justificante' (ticket del técnico)
 */
import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, X, RefreshCw, FileText, ScanLine, Sparkles, Clock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DocumentEdgeCrop from '@/components/gastos/DocumentEdgeCrop';
import { sharpenAndEnhance } from '@/lib/imageEnhance';
import {
  extraerDatosMulta, reprocesarPrecisionMulta, evaluarPrecisionMulta,
  extraerDatosJustificante, reprocesarPrecisionJustificante, evaluarPrecisionJustificante,
} from '@/lib/ocrMultas';

const esVolante = (tipo) => tipo === 'volante';

export default function MultaDocumentoOcr({ tipo = 'volante', onComplete, label, descripcion }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState('idle'); // idle | edgecrop | enhancing | subiendo | ocr | respaldo | done | error
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [datos, setDatos] = useState(null);
  const [confianza, setConfianza] = useState(null);
  const [precisa, setPrecisa] = useState(false);
  const [precisionMotivo, setPrecisionMotivo] = useState('');
  const [error, setError] = useState('');
  const [respaldoUsado, setRespaldoUsado] = useState(false);

  const etiqueta = label || (esVolante(tipo) ? 'Volante oficial' : 'Justificante del técnico');
  const descDefault = esVolante(tipo)
    ? 'Fotografía el aviso/multa. Se endereza, se mejora la nitidez y se extraen todos los datos por IA.'
    : 'Ticket de parking / justificante del técnico. Se extraen fecha, hora e importe por IA.';
  const descripcionFinal = descripcion || descDefault;

  const reset = () => {
    setStep('idle');
    setFile(null);
    setFileUrl(null);
    setDatos(null);
    setConfianza(null);
    setPrecisa(false);
    setPrecisionMotivo('');
    setError('');
    setRespaldoUsado(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const elegirArchivo = (f) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error('El archivo supera los 15 MB');
      return;
    }
    // Las imágenes pasan por enderezado; PDF y otros van directos a mejora/subida
    if (f.type.startsWith('image/')) {
      setFile(f);
      setStep('edgecrop');
    } else {
      setFile(f);
      procesarDocumento(f);
    }
  };

  const procesarDocumento = async (archivo, skipEnhance = false) => {
    setStep('enhancing');
    setError('');
    try {
      // 1. Mejora de nitidez (solo imágenes)
      let archivoFinal = archivo;
      if (archivo.type.startsWith('image/') && !skipEnhance) {
        archivoFinal = await sharpenAndEnhance(archivo);
      }

      // 2. Subida a CDN
      setStep('subiendo');
      const res = await base44.integrations.Core.UploadPublicFile({ file: archivoFinal });
      const url = res?.file_url || res?.data?.file_url;
      if (!url) throw new Error('No se obtuvo URL de subida');
      setFileUrl(url);

      // 3. OCR primario
      setStep('ocr');
      const { datos: d, error: errOCR } = esVolante(tipo)
        ? await extraerDatosMulta(url)
        : await extraerDatosJustificante(url);
      if (errOCR) throw new Error(errOCR);
      setDatos(d);
      setConfianza(typeof d?.confianza === 'number' ? d.confianza : null);

      // 4. Evaluar precisión → respaldo IA si hace falta
      const evalPrec = esVolante(tipo) ? evaluarPrecisionMulta(d) : evaluarPrecisionJustificante(d);
      setPrecisa(evalPrec.precisa);
      setPrecisionMotivo(evalPrec.motivo);

      let datosFinales = d;
      let confianzaFinal = typeof d?.confianza === 'number' ? d.confianza : null;
      let respaldoAplicado = false;

      if (evalPrec.precisa) {
        // Respaldo IA automático (gemini_3_flash)
        setStep('respaldo');
        const { datos: d2, error: err2 } = esVolante(tipo)
          ? await reprocesarPrecisionMulta(url)
          : await reprocesarPrecisionJustificante(url);
        if (!err2 && d2) {
          setDatos(d2);
          setConfianza(typeof d2.confianza === 'number' ? d2.confianza : null);
          setRespaldoUsado(true);
          datosFinales = d2;
          confianzaFinal = typeof d2.confianza === 'number' ? d2.confianza : null;
          respaldoAplicado = true;
        }
      }

      setStep('done');
      // Notificar al padre con los datos finales (datosFinales evita cierre obsoleto)
      onComplete?.({
        file_url: url,
        datos: datosFinales,
        confianza: confianzaFinal,
        precisa: evalPrec.precisa,
        precision_motivo: evalPrec.motivo,
        respaldo_ia: respaldoAplicado,
      });
    } catch (e) {
      console.error('OCR multa falló', e);
      setError(String(e?.message || 'Error procesando el documento').slice(0, 140));
      setStep('error');
    }
  };

  // Vista de enderezado/recorte (solo imágenes)
  if (step === 'edgecrop' && file) {
    return (
      <div className="space-y-3">
        <DocumentEdgeCrop
          file={file}
          onConfirm={(f) => { setFile(f); procesarDocumento(f); }}
          onSkip={() => { procesarDocumento(file, true); }}
          onCancel={reset}
        />
      </div>
    );
  }

  // Estado final: documento procesado + datos extraídos
  if (step === 'done' && fileUrl) {
    const esImagen = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileUrl);
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 flex-1">
            {etiqueta} procesado{respaldoUsado ? ' con respaldo IA' : ''} · confianza {confianza != null ? `${Math.round(confianza * 100)}%` : '—'}
          </p>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={reset} title="Reemplazar">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Vista previa del documento */}
        <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 hover:bg-muted/50 transition-colors">
          {esImagen ? (
            <img src={fileUrl} alt={etiqueta} className="w-14 h-14 object-cover rounded-md border" />
          ) : (
            <div className="w-14 h-14 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium truncate">{etiqueta}</p>
            <span className="text-primary underline">Abrir documento</span>
          </div>
        </a>

        {/* Datos extraídos */}
        {datos && <DatosExtraidos datos={datos} tipo={tipo} />}
      </div>
    );
  }

  // Estado de error
  if (step === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 flex-1 truncate">{error}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset} className="w-full gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </Button>
      </div>
    );
  }

  // Estado de procesamiento (enhancing / subiendo / ocr / respaldo)
  const procesando = ['enhancing', 'subiendo', 'ocr', 'respaldo'].includes(step);
  const textoProceso = {
    enhancing: 'Mejorando nitidez…',
    subiendo: 'Subiendo documento…',
    ocr: 'Extrayendo datos (IA)…',
    respaldo: 'Respaldo IA de precisión…',
  }[step] || 'Procesando…';

  if (procesando) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
        <p className="text-xs text-muted-foreground flex-1">{textoProceso}</p>
        {step === 'respaldo' && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
      </div>
    );
  }

  // Estado idle: botones de captura
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{descripcionFinal}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className={cn('flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors')}>
          <Camera className="w-6 h-6 text-primary" />
          <span className="text-xs font-medium text-primary">Hacer foto</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        <label className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Subir archivo</span>
          <input
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}

// ── Subcomponente: muestra los datos extraídos ──────────────
function DatosExtraidos({ datos, tipo }) {
  const campos = esVolante(tipo)
    ? [
        { key: 'fecha_multa', label: 'Fecha', icon: CalendarDays },
        { key: 'hora_multa', label: 'Hora', icon: Clock, highlight: true },
        { key: 'importe', label: 'Importe', format: (v) => `${Number(v).toFixed(2)} €` },
        { key: 'autoridad', label: 'Autoridad' },
        { key: 'numero_expediente', label: 'Expediente' },
        { key: 'lugar_infraccion', label: 'Lugar' },
        { key: 'matricula_impresa', label: 'Matrícula' },
        { key: 'motivo', label: 'Motivo', full: true },
      ]
    : [
        { key: 'fecha_documento', label: 'Fecha' },
        { key: 'hora_documento', label: 'Hora', icon: Clock, highlight: true },
        { key: 'importe', label: 'Importe', format: (v) => `${Number(v).toFixed(2)} €` },
        { key: 'nombre_comercio', label: 'Operador' },
        { key: 'lugar', label: 'Lugar' },
        { key: 'matricula_impresa', label: 'Matrícula' },
        { key: 'tipo_justificante', label: 'Tipo' },
      ];

  const visibles = campos.filter((c) => {
    const v = datos?.[c.key];
    return v != null && v !== '' && !(c.format && Number.isNaN(Number(v)));
  });

  if (!visibles.length) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <ScanLine className="w-3 h-3" /> Datos extraídos por IA
      </p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {visibles.map((c) => {
          const v = datos[c.key];
          const Icon = c.icon;
          return (
            <div key={c.key} className={cn('flex flex-col', c.full && 'col-span-2')}>
              <span className="text-[9px] text-muted-foreground uppercase">{c.label}</span>
              <span className={cn(
                'text-xs font-medium',
                c.highlight && 'text-primary font-bold flex items-center gap-1',
              )}>
                {Icon && <Icon className="w-3 h-3" />}
                {c.format ? c.format(v) : String(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}