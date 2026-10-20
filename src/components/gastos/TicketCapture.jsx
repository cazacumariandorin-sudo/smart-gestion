import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { calcularDHash } from '@/lib/duplicadoGasto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, SkipForward, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, FileText, Layers, RefreshCw, SplitSquareHorizontal, AlertTriangle, Edit3 } from 'lucide-react';
import { extraerDatosGastoMulti, procesarResultadoMulti, evaluarPrecision } from '@/lib/ocrGastos';
import { subirArchivo } from '@/lib/subirArchivo';
import DocumentEdgeCrop, { autoCropFile } from '@/components/gastos/DocumentEdgeCrop';
import { debeAjustarManualmente } from '@/lib/decisionRecorte';

async function comprimirImagen(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const original = e.target.result;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 3200; // lado máximo: un ticket alargado necesita ancho suficiente para leerse
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(original); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch { resolve(original); }
      };
      img.onerror = () => resolve(original);
      img.src = original;
    };
    reader.onerror = () => resolve(null);
  });
}

function fusionarDatos(paginas) {
  const merged = {
    fecha_documento: '', importe: null, nombre_comercio: '', nif_comercio: '',
    numero_factura: '', codigo_validacion_fiscal: '', categoria: '', concepto: '', confianza: 0,
    hora_documento: '', localidad: '', forma_pago_documento: '',
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
    if (!merged.hora_documento && d.hora_documento) merged.hora_documento = d.hora_documento;
    if (!merged.localidad && d.localidad) merged.localidad = d.localidad;
    if (!merged.forma_pago_documento && d.forma_pago_documento) merged.forma_pago_documento = d.forma_pago_documento;
    if (d.importe != null && !isNaN(Number(d.importe))) importes.push(Number(d.importe));
    if (typeof d.confianza === 'number' && d.confianza > maxConfianza) maxConfianza = d.confianza;
  }
  if (importes.length) merged.importe = Math.max(...importes);
  if (maxConfianza > 0) merged.confianza = maxConfianza;
  return merged;
}

const CATEGORIAS = ['combustible', 'peaje', 'parking', 'comida', 'material', 'otros'];

function MultiTicketDialog({ registros, filePreview, onConfirmar, onCancelar }) {
  const [items, setItems] = useState(registros.map((r, i) => ({ ...r, datos: { ...r.datos }, activo: true, _key: i })));
  const [editando, setEditando] = useState(null);

  const updateDatos = (idx, campo, valor) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, datos: { ...it.datos, [campo]: valor } } : it));
  };
  const toggleActivo = (idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, activo: !it.activo } : it));
  };

  const activosCount = items.filter(it => it.activo).length;
  const importeTotal = items.filter(it => it.activo && it.datos.importe != null).reduce((a, it) => a + Number(it.datos.importe || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start gap-3 p-5 border-b">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <SplitSquareHorizontal className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">{registros.length} tickets detectados en la misma foto</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se creará <strong>{activosCount} registro{activosCount !== 1 ? 's' : ''}</strong> separado{activosCount !== 1 ? 's' : ''}. Revisa y confirma.
            </p>
          </div>
        </div>

        {registros[0]?.advertencias?.length > 0 && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 items-start">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700">{registros[0].advertencias[0]}</span>
          </div>
        )}

        {filePreview && (
          <div className="mx-4 mt-3 flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
            <img src={filePreview} alt="foto original" className="w-12 h-12 object-cover rounded-lg border shrink-0" />
            <p className="text-xs text-muted-foreground">Foto original compartida — todos los registros quedan vinculados a esta imagen.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.map((it, idx) => (
            <div key={it._key} className={`border rounded-xl transition-all ${it.activo ? 'border-primary/30 bg-card shadow-sm' : 'border-muted bg-muted/30 opacity-50'}`}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
                <input type="checkbox" checked={it.activo} onChange={() => toggleActivo(idx)} className="w-4 h-4 rounded accent-primary" />
                <span className="text-xs font-bold text-muted-foreground flex-1">Ticket {idx + 1} de {items.length}</span>
                {it.precisa_precision && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-300">Revisar</span>
                )}
                <button onClick={() => setEditando(editando === idx ? null : idx)} className="p-1 rounded hover:bg-muted transition-colors">
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex-1">{it.datos.nombre_comercio || <span className="text-muted-foreground italic">Sin comercio</span>}</span>
                  <span className={`text-base font-bold font-mono shrink-0 ${it.datos.importe != null ? 'text-foreground' : 'text-destructive'}`}>
                    {it.datos.importe != null ? `${Number(it.datos.importe).toFixed(2)} €` : '? €'}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{it.datos.fecha_documento || 'Sin fecha'}</span>
                  {it.datos.hora_documento && <span>· {it.datos.hora_documento}</span>}
                  {it.datos.localidad && <span>· {it.datos.localidad}</span>}
                </div>
                {it.datos.concepto && <p className="text-xs text-muted-foreground truncate">{it.datos.concepto}</p>}
                {it.precisa_precision && it.precision_motivo && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />{it.precision_motivo}
                  </p>
                )}
              </div>
              {editando === idx && (
                <div className="px-3 pb-3 border-t border-inherit pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Comercio</label>
                      <Input value={it.datos.nombre_comercio || ''} onChange={e => updateDatos(idx, 'nombre_comercio', e.target.value)} className="h-7 text-xs mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Importe (€)</label>
                      <Input type="number" step="0.01" min="0" value={it.datos.importe ?? ''} onChange={e => updateDatos(idx, 'importe', parseFloat(e.target.value) || null)} className="h-7 text-xs mt-0.5 font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Fecha</label>
                      <Input type="date" value={it.datos.fecha_documento || ''} onChange={e => updateDatos(idx, 'fecha_documento', e.target.value)} className="h-7 text-xs mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Categoría</label>
                      <select value={it.datos.categoria || ''} onChange={e => updateDatos(idx, 'categoria', e.target.value)} className="w-full h-7 text-xs mt-0.5 border rounded-md px-1.5 bg-background">
                        <option value="">— elegir —</option>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium text-muted-foreground">Concepto</label>
                      <Input value={it.datos.concepto || ''} onChange={e => updateDatos(idx, 'concepto', e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Descripción del gasto" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">{activosCount} registro{activosCount !== 1 ? 's' : ''} a crear</span>
            <span className="font-bold font-mono">Total: {importeTotal.toFixed(2)} €</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-sm" onClick={onCancelar}>Cancelar</Button>
            <Button className="flex-1 text-sm gap-1.5 bg-primary" disabled={activosCount === 0} onClick={() => onConfirmar(items.filter(it => it.activo))}>
              <CheckCircle2 className="w-4 h-4" />
              Crear {activosCount} registro{activosCount !== 1 ? 's' : ''}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Los registros marcados como "Revisar" irán al panel de precisión.</p>
        </div>
      </div>
    </div>
  );
}
export default function TicketCapture({ onDone, onDoneMulti, onSkip }) {
  const [paginas, setPaginas] = useState([]);
  const [pendienteEditar, setPendienteEditar] = useState(null);
   const [detectando, setDetectando] = useState(false); // detectando bordes de la última foto capturada
  const [multiTicketPendiente, setMultiTicketPendiente] = useState(null);

  // Recorte de bordes: se aplica EN SILENCIO cuando la detección es fiable (criterio en
  // decisionRecorte.js); solo se muestra el editor manual si hace falta corregir algo.
  // El técnico puede pulsar "Ajustar bordes" después para corregirlo si no está conforme.
  const nuevaCaptura = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { procesarPagina(f); return; }
    setDetectando(true);
    const auto = await autoCropFile(f);
    setDetectando(false);
    if (!auto || debeAjustarManualmente(auto.corners, auto.natural, auto.autoOk)) {
      setPendienteEditar(f);
      return;
    }
       procesarPagina(auto.file, null, f);
  };

  // Procesa una página: sube + OCR multi-ticket. Si existingIdx, actualiza in situ (reintento).
   const procesarPagina = async (file, existingIdx = null, originalSinRecortar = null) => {
    if (!file) return;
    const idx = existingIdx != null ? existingIdx : paginas.length;
    const preview = URL.createObjectURL(file);
    if (existingIdx == null) {
      setPaginas(prev => [...prev, { file, original: originalSinRecortar || file, preview, file_url: null, ocr_datos: null, ocr_raw: '', estado: 'subiendo', errorMsg: '', tipo_caso: null, n_documentos: 0 }]);
    } else {
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'subiendo', errorMsg: '', file_url: null, ocr_datos: null, ocr_raw: '', tipo_caso: null, preview } : p));
    }

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
      const dhash = esImagen ? await calcularDHash(subidaFile) : '';
      setPaginas(prev => prev.map((p, i) => i === idx ? { ...p, estado: 'ocr', dhash } : p));
      const subida = await subirArchivo(subidaFile);
      // URL del almacenamiento de Base44 (legible por el modelo y estable para re-OCR). Si Drive subió bien,
      // file_url es un enlace de descarga de Drive que el OCR no puede leer.
      const file_url = subida?.cdn_url_para_llm || subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo');

      // OCR multi-ticket
      const { resultado, error } = await extraerDatosGastoMulti(file_url);
      if (error || !resultado) throw new Error(error || 'Sin respuesta OCR');

      const { tipo_caso, n_documentos, documentos = [] } = resultado;

      // CASO MULTI-TICKET: diálogo de confirmación
      if (tipo_caso === 'multi_ticket' && n_documentos > 1) {
        const registrosProcesados = procesarResultadoMulti(resultado, file_url);
        setPaginas(prev => prev.map((p, i) => i === idx ? {
          ...p, file_url, estado: 'multi', tipo_caso: 'multi_ticket', n_documentos,
          ocr_datos: documentos[0] || null, ocr_raw: JSON.stringify(resultado, null, 2),
        } : p));
        setMultiTicketPendiente({ registros: registrosProcesados, fileUrl: file_url, preview, paginaIdx: idx });
        return;
      }

      // CASO INVÁLIDO / REVERSO
      if (tipo_caso === 'imagen_invalida' || tipo_caso === 'reverso_sin_importe' || n_documentos === 0) {
        setPaginas(prev => prev.map((p, i) => i === idx ? {
          ...p, file_url, estado: 'ok', tipo_caso, n_documentos: 0, ocr_datos: null,
          ocr_raw: tipo_caso,
          errorMsg: tipo_caso === 'imagen_invalida' ? 'Imagen inválida o en blanco' : 'Parece el reverso del ticket',
        } : p));
        return;
      }

      // CASO NORMAL: 1 documento (uno_solo o ticket_parcial)
      const datos = documentos[0] || null;
      setPaginas(prev => prev.map((p, i) => i === idx ? {
        ...p, file_url, estado: 'ok', tipo_caso, n_documentos,
        ocr_datos: datos, ocr_raw: datos ? JSON.stringify(datos, null, 2) : '', errorMsg: '',
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
    procesarPagina(pag.file, idx);
  };
  const [ajustandoIdx, setAjustandoIdx] = useState(null); // índice de página cuyo recorte se está corrigiendo a mano
  const ajustarBordes = (idx) => setAjustandoIdx(idx);

  const confirmarMultiTicket = useCallback((registrosConfirmados) => {
    if (!multiTicketPendiente) return;
    const { fileUrl, preview, paginaIdx } = multiTicketPendiente;
    setPaginas(prev => prev.map((p, i) => i === paginaIdx ? { ...p, estado: 'ok_multi', n_confirmados: registrosConfirmados.length } : p));
    setMultiTicketPendiente(null);
    const registrosParaCrear = registrosConfirmados.map((r) => ({
      datos: r.datos || {},
      precisa_precision: !!r.precisa_precision,
      precision_motivo: r.precision_motivo || '',
      archivos: [{ url: fileUrl, nombre: 'ticket_multi.jpg', tipo: 'image/jpeg', storage: 'cdn' }],
      preview,
      ocr_raw: (r.datos || {}).ocr_raw || JSON.stringify(r.datos || {}, null, 2),
      ocr_ok: true,
      error_ocr: null,
      _es_multi: true,
      _idx_en_foto: r._idx ?? 0,
      _total_en_foto: r._total_en_foto ?? registrosConfirmados.length,
    }));
    if (onDoneMulti) {
      onDoneMulti(registrosParaCrear);
    } else if (registrosParaCrear.length === 1) {
      onDone?.(registrosParaCrear[0]);
    } else {
      // Sin manejador multi: fusionar y enviar como uno solo
      onDone?.(registrosParaCrear[0]);
    }
  }, [multiTicketPendiente, onDone, onDoneMulti]);

  const cancelarMultiTicket = useCallback(() => {
    if (!multiTicketPendiente) return;
    const { registros, paginaIdx } = multiTicketPendiente;
    setMultiTicketPendiente(null);
    const datosFusionados = {
      nombre_comercio: registros[0]?.datos?.nombre_comercio || '',
      fecha_documento: registros[0]?.datos?.fecha_documento || '',
      categoria: registros[0]?.datos?.categoria || '',
      importe: registros.reduce((a, r) => a + Number(r.datos?.importe || 0), 0),
      concepto: `${registros.length} tickets agrupados`,
      confianza: 0.5,
    };
    setPaginas(prev => prev.map((p, i) => i === paginaIdx ? { ...p, estado: 'ok', ocr_datos: datosFusionados } : p));
  }, [multiTicketPendiente]);

  const continuar = () => {
    const okPaginas = paginas.filter(p => p.estado === 'ok' && p.file_url);
    if (!okPaginas.length) { onDone({ archivos: [], preview: null, ocr_raw: '', ocr_ok: false, datos: null }); return; }
    const datosFusionados = fusionarDatos(okPaginas);
    const { precisa, motivo } = evaluarPrecision(datosFusionados);
    const archivos = okPaginas.map(p => ({ url: p.file_url, nombre: p.file.name, tipo: p.file.type, storage: 'cdn', dhash: p.dhash || '' }));
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

  const todasOk = paginas.length > 0 && paginas.every(p => p.estado === 'ok' || p.estado === 'ok_multi');
  const algunaProcesando = paginas.some(p => p.estado === 'subiendo' || p.estado === 'ocr' || p.estado === 'multi');

  if (ajustandoIdx != null && paginas[ajustandoIdx]) {
    const pag = paginas[ajustandoIdx];
    return (
      <div className="space-y-4 py-2">
        <DocumentEdgeCrop
          file={pag.original}
          onConfirm={(f) => { setAjustandoIdx(null); procesarPagina(f, ajustandoIdx, pag.original); }}
          onSkip={() => setAjustandoIdx(null)}
          onCancel={() => setAjustandoIdx(null)}
        />
      </div>
    );
  }
  if (pendienteEditar) {
    return (
      <div className="space-y-4 py-2">
         <DocumentEdgeCrop
          file={pendienteEditar}
          onConfirm={(f) => { setPendienteEditar(null); procesarPagina(f); }}
          onSkip={() => { const orig = pendienteEditar; setPendienteEditar(null); procesarPagina(orig); }}
          onCancel={() => setPendienteEditar(null)}
        />
        <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
          <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {multiTicketPendiente && (
        <MultiTicketDialog
          registros={multiTicketPendiente.registros}
          filePreview={multiTicketPendiente.preview}
          onConfirmar={confirmarMultiTicket}
          onCancelar={cancelarMultiTicket}
        />
      )}

      {detectando && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Encuadrando el documento…
        </div>
      )}

      {paginas.length === 0 ? (
        <>
          <p className="text-sm text-center text-muted-foreground">Fotografía o sube el ticket / factura</p>
          <p className="text-[11px] text-center text-muted-foreground opacity-70">Si tiene varias páginas, añade una por cada página. Si hay varios tickets en la misma foto, se detectarán automáticamente.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
              <Camera className="w-8 h-8 text-primary" />
              <span className="text-sm font-medium text-primary">Hacer foto</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) nuevaCaptura(f); e.target.value = ''; }} />
            </label>
            <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Subir archivo</span>
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) nuevaCaptura(f); e.target.value = ''; }} />
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              {paginas.length} página{paginas.length !== 1 ? 's' : ''} capturada{paginas.length !== 1 ? 's' : ''}
              {algunaProcesando && <span className="text-primary font-normal">· procesando…</span>}
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
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {p.estado === 'subiendo' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-[10px] text-muted-foreground">Subiendo…</span></>}
                    {p.estado === 'ocr' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-[10px] text-muted-foreground">Analizando tickets…</span></>}
                    {p.estado === 'multi' && <><SplitSquareHorizontal className="w-3 h-3 text-amber-600 animate-pulse" /><span className="text-[10px] text-amber-700 font-medium">{p.n_documentos} tickets detectados — confirmando…</span></>}
                    {p.estado === 'ok_multi' && <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="text-[10px] text-emerald-700">{p.n_confirmados} registros separados listos</span></>}
                    {p.estado === 'ok' && <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="text-[10px] text-emerald-700">{p.ocr_datos ? (p.tipo_caso === 'ticket_parcial' ? 'Ticket incompleto — revisa' : 'Datos extraídos') : 'Sin texto legible'}</span>{p.ocr_datos?.importe != null && <span className="text-[10px] font-bold font-mono text-foreground ml-1">{Number(p.ocr_datos.importe).toFixed(2)} €</span>}</>}
                    {p.estado === 'error' && <><AlertCircle className="w-3 h-3 text-amber-500" /><span className="text-[10px] text-amber-600">Error — reintentar</span></>}
                  </div>
                </div>
                {p.estado === 'error' && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => reintentar(idx)} title="Reintentar">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 hover:text-destructive" onClick={() => eliminarPagina(idx)} title="Quitar página">
                   {p.original && p.estado !== 'subiendo' && p.estado !== 'ocr' && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => ajustarBordes(idx)} title="Ajustar bordes">
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                )}
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors text-sm font-medium text-primary">
              <Camera className="w-4 h-4" /> Otra foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) nuevaCaptura(f); e.target.value = ''; }} />
            </label>
            <label className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors text-sm font-medium text-muted-foreground">
              <Upload className="w-4 h-4" /> Subir
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) nuevaCaptura(f); e.target.value = ''; }} />
            </label>
          </div>

          {todasOk && paginas.some(p => p.ocr_datos) && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Datos de {paginas.filter(p => p.ocr_datos).length} página{paginas.filter(p => p.ocr_datos).length !== 1 ? 's' : ''} extraídos. Revisa el formulario antes de guardar.</p>
            </div>
          )}

          {paginas.some(p => p.estado === 'ok') && (
            <Button onClick={continuar} disabled={algunaProcesando || !paginas.some(p => p.estado === 'ok')} className="w-full gap-2">
              {algunaProcesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {algunaProcesando ? 'Procesando páginas…' : `Continuar con ${paginas.filter(p => p.estado === 'ok').length} página${paginas.filter(p => p.estado === 'ok').length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </>
      )}

      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
        <SkipForward className="w-3.5 h-3.5" /> Saltar — rellenar manualmente
      </Button>
    </div>
  );
}

function algunProcesando(paginas) {
  return paginas.some(p => p.estado === 'subiendo' || p.estado === 'ocr' || p.estado === 'multi');
}