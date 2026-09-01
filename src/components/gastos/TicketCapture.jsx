import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, SkipForward, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, FileText, Layers, RefreshCw } from 'lucide-react';
import { extraerDatosGasto, evaluarPrecision } from '@/lib/ocrGastos';

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

// Fusiona los datos OCR de varias páginas. Para cada campo toma el primer
// valor no vacío; para importe toma el máximo (el total suele ser el mayor).
function fusionarDatos(paginas) {
  const merged = {
    fecha_documento: '', importe: null, nombre_comercio: '', nif_comercio: '',
    numero_factura: '', codigo_validacion_fiscal: '', categoria: '', concepto: '', confianza: 0,
  };
  let importes = [];
  let maxConfianza = 0;
  for (const p of paginas) {
    const d = p.ocr_datos;
    if (!d) continue;
    if (!merged.fecha_documento && d.fecha_documento) merged.fecha_documento = d.fecha_documento;
    if (!merged.nombre_comercio && d.nombre_comercio) merged.nombre_comercio = d.nombre_comercio;
    if (!merged.nif_comercio && d.nif_comercio) merged.nif_comercio = d.nif_comercio;
    if (!merged.numero_factura && d.numero_factura) merged.numero_factura = d.numero_factura;
    if (!merged.codigo_validacion_fiscal && d.codigo_validacion_fiscal) merged.codigo_validacion_fiscal = d.codigo_validacion_fiscal;
    if (!merged.categoria && d.categoria) merged.categoria = d.categoria;
    if (!merged.concepto && d.concepto) merged.concepto = d.concepto;
    if (d.importe != null && !isNaN(Number(d.importe))) importes.push(Number(d.importe));
    if (typeof d.confianza === 'number' && d.confianza > maxConfianza) maxConfianza = d.confianza;
  }
  if (importes.length) merged.importe = Math.max(...importes);
  if (maxConfianza > 0) merged.confianza = maxConfianza;
  return merged;
}

export default function TicketCapture({ onDone, onSkip }) {
  const [paginas, setPaginas] = useState([]); // { file, preview, file_url, ocr_datos, ocr_raw, estado: 'subiendo'|'ocr'|'ok'|'error', errorMsg }
  const [procesandoFinal, setProcesandoFinal] = useState(false);

  const procesarPagina = async (file) => {
    if (!file) return;
    const idx = paginas.length;
    const preview = URL.createObjectURL(file);
    const nueva = { file, preview, file_url: null, ocr_datos: null, ocr_raw: '', estado: 'subiendo', errorMsg: '' };
    setPaginas(prev => [...prev, nueva]);

    try {
      const esImagen = file.type.startsWith('image/');
      const base64 = esImagen
        ? await comprimirImagen(file)
        : await new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = rej; });
      if (!base64) throw new Error('No se pudo leer el archivo');

      let subidaFile = file;
      if (esImagen && base64.startsWith('data:')) {
        const parts = base64.split(',');
        const mime = (parts[0].match(/:(.*?);/)?.[1]) || file.type;
        const binStr = atob(parts[1]);
        const u8 = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) u8[i] = binStr.charCodeAt(i);
        const ext = (mime.split('/')[1] || 'jpeg').split('+')[0];
        subidaFile = new File([u8], file.name.replace(/\.(jpe?g|png|gif|webp|pdf)$/i, '') + '_comp.' + ext, { type: mime });
      }

      // Marcar como subiendo
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'ocr' } : p));
      const subida = await base44.integrations.Core.UploadFile({ file: subidaFile });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo');

      const { datos, error } = await extraerDatosGasto(file_url);
      const textoOcr = (datos && !error) ? JSON.stringify(datos, null, 2) : '';
      setPaginas(prev => prev.map((p, i) => i === idx ? {
        ...p, file_url, estado: 'ok', ocr_datos: datos || null, ocr_raw: textoOcr, errorMsg: error || '',
      } : p));
    } catch (err) {
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'error', errorMsg: String(err?.message || '').slice(0, 120) } : p));
    }
  };

  const eliminarPagina = (idx) => {
    setPaginas(prev => {
      const copia = [...prev];
      URL.revokeObjectURL?.(copia[idx]?.preview);
      copia.splice(idx, 1);
      return copia;
    });
  };

  const reintentar = (idx) => {
    const pag = paginas[idx];
    if (!pag?.file) return;
    setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'subiendo', errorMsg: '', file_url: null, ocr_datos: null, ocr_raw: '' } : p));
    procesarPaginaIdx(idx, pag.file);
  };

  const procesarPaginaIdx = async (idx, file) => {
    try {
      const esImagen = file.type.startsWith('image/');
      const base64 = esImagen ? await comprimirImagen(file) : await new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = rej; });
      if (!base64) throw new Error('No se pudo leer el archivo');
      let subidaFile = file;
      if (esImagen && base64.startsWith('data:')) {
        const parts = base64.split(','); const mime = (parts[0].match(/:(.*?);/)?.[1]) || file.type;
        const binStr = atob(parts[1]); const u8 = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) u8[i] = binStr.charCodeAt(i);
        const ext = (mime.split('/')[1] || 'jpeg').split('+')[0];
        subidaFile = new File([u8], file.name.replace(/\.(jpe?g|png|gif|webp|pdf)$/i, '') + '_comp.' + ext, { type: mime });
      }
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'ocr' } : p));
      const subida = await base44.integrations.Core.UploadFile({ file: subidaFile });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir');
      const { datos, error } = await extraerDatosGasto(file_url);
      const textoOcr = (datos && !error) ? JSON.stringify(datos, null, 2) : '';
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, file_url, estado: 'ok', ocr_datos: datos || null, ocr_raw: textoOcr, errorMsg: error || '' } : p));
    } catch (err) {
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'error', errorMsg: String(err?.message || '').slice(0, 120) } : p));
    }
  };

  const todasOk = paginas.length > 0 && paginas.every(p => p.estado === 'ok');
  const algunaProcesando = paginas.some(p => p.estado === 'subiendo' || p.estado === 'ocr');

  const continuar = () => {
    const okPaginas = paginas.filter(p => p.estado === 'ok' && p.file_url);
    if (!okPaginas.length) { onDone({ archivos: [], preview: null, ocr_raw: '', ocr_ok: false, datos: null }); return; }
    const datosFusionados = fusionarDatos(okPaginas);
    const { precisa, motivo } = evaluarPrecision(datosFusionados);
    const archivos = okPaginas.map(p => ({ url: p.file_url, nombre: p.file.name, tipo: p.file.type, storage: 'cdn' }));
    onDone({
      archivos,
      preview: okPaginas[0].preview,
      ocr_raw: okPaginas.map(p => p.ocr_raw).filter(Boolean).join('\n\n--- página ---\n\n'),
      datos: datosFusionados,
      precisa_precision: precisa,
      precision_motivo: motivo,
      ocr_ok: okPaginas.some(p => p.ocr_datos),
      error_ocr: null,
    });
  };

  const isMobile = 'ontouchstart' in window;

  return (
    <div className="space-y-4 py-2">
      {paginas.length === 0 ? (
        <>
          <p className="text-sm text-center text-muted-foreground">Fotografía o sube el ticket / factura</p>
          <p className="text-[11px] text-center text-muted-foreground opacity-70">Si tiene varias páginas, añade una por cada página</p>
          {isMobile ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
                <Camera className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-primary">Hacer foto</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
              </label>
              <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Subir archivo</span>
                <input type="file" accept="image/*,.pdf" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
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
                onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
            </label>
          )}
        </>
      ) : (
        <>
          {/* Lista de páginas */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              {paginas.length} página{paginas.length !== 1 ? 's' : ''} capturada{paginas.length !== 1 ? 's' : ''}
              {algunProcesando(paginas) && <span className="text-primary font-normal">· procesando…</span>}
            </div>
            {paginas.map((p, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl border bg-card">
                <div className="relative shrink-0">
                  {p.preview && p.file?.type?.startsWith('image/') ? (
                    <img src={p.preview} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg border bg-muted flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.file?.name || `Página ${idx + 1}`}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.estado === 'subiendo' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-[10px] text-muted-foreground">Subiendo…</span></>}
                    {p.estado === 'ocr' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-[10px] text-muted-foreground">OCR…</span></>}
                    {p.estado === 'ok' && <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="text-[10px] text-emerald-700">{p.ocr_datos ? 'Datos extraídos' : 'Sin texto legible'}</span></>}
                    {p.estado === 'error' && <><AlertCircle className="w-3 h-3 text-amber-500" /><span className="text-[10px] text-amber-600">Error — reintentar</span></>}
                  </div>
                </div>
                {p.estado === 'error' && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => reintentar(idx)} title="Reintentar">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 hover:text-destructive" onClick={() => eliminarPagina(idx)} title="Quitar página">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Añadir otra página */}
          <div className="flex gap-2">
            {isMobile ? (
              <>
                <label className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors text-sm font-medium text-primary">
                  <Camera className="w-4 h-4" /> Otra foto
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors text-sm font-medium text-muted-foreground">
                  <Upload className="w-4 h-4" /> Subir
                  <input type="file" accept="image/*,.pdf" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
                </label>
              </>
            ) : (
              <label className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors text-sm font-medium text-primary">
                <Plus className="w-4 h-4" /> Añadir otra página
                <input type="file" accept="image/*,.pdf" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) procesarPagina(f); e.target.value = ''; }} />
              </label>
            )}
          </div>

          {/* Resumen OCR si hay datos */}
          {todasOk && paginas.some(p => p.ocr_datos) && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Datos fusionados de {paginas.filter(p => p.ocr_datos).length} página{paginas.filter(p => p.ocr_datos).length !== 1 ? 's' : ''}. Revisa el formulario antes de guardar.
              </p>
            </div>
          )}

          {/* Botón continuar */}
          <Button onClick={continuar} disabled={algunProcesando || !paginas.length} className="w-full gap-2">
            {algunProcesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {algunProcesando ? 'Procesando páginas…' : `Continuar con ${paginas.length} página${paginas.length !== 1 ? 's' : ''}`}
          </Button>
        </>
      )}

      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
        <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
      </Button>
    </div>
  );
}

function algunProcesando(paginas) {
  return paginas.some(p => p.estado === 'subiendo' || p.estado === 'ocr');
}