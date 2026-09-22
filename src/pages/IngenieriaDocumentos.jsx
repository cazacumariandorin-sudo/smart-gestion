import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Copy, AlertTriangle } from 'lucide-react';
import ProyectoSelector from '@/components/ingenieria/ProyectoSelector';
import { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';
import { detectRevision, matchObra, detectTipo } from '@/lib/ingenieriaFilename';
import { calcularHash, detectarDuplicado, diffDatos, DiffList } from '@/lib/ingenieriaDiff.jsx';

const TIPO_OCR = {
  listado_puntos: { fn: 'procesarListadoPuntos', label: 'Listado de puntos' },
  lista_material: { fn: 'procesarListadoPuntos', label: 'Lista de material (proceso)' },
  esquema_conexion: { fn: 'procesarEsquemaConexion', label: 'Esquema de conexión (eléctrico)' },
  pid_proceso: { fn: 'procesarPidProceso', label: 'P&ID de proceso' },
  ficha_tecnica_equipo: { fn: 'procesarFichaTecnicaEquipo', label: 'Ficha técnica de equipo' },
  plano_planta: { fn: 'procesarPlanoPlanta', label: 'Plano de planta' },
  factura: { fn: 'procesarFacturaMateriales', label: 'Factura' },
  albaran: { fn: 'procesarFacturaMateriales', label: 'Albarán' },
  proforma: { fn: 'procesarFacturaMateriales', label: 'Proforma' },
  pedido: { fn: 'procesarFacturaMateriales', label: 'Pedido' },
  presupuesto: { fn: 'procesarFacturaMateriales', label: 'Presupuesto' },
};

export default function IngenieriaDocumentos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { obras } = useIngenieriaProyectos();
  const [obraId, setObraId] = useState(null);
  const [tipo, setTipo] = useState('listado_puntos');
  const [revision, setRevision] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [estado, setEstado] = useState('idle'); // idle | subiendo | ocr | guardando | ok | error
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [autoInfo, setAutoInfo] = useState('');
  const [precisionId, setPrecisionId] = useState(null);
  const [precisionMsg, setPrecisionMsg] = useState('');
  const [precisionDiff, setPrecisionDiff] = useState(null);

  const obra = obras.find(o => o.id === obraId);
  const effectiveObraId = obraId || obras[0]?.id;

  const { data: documentos = [] } = useQuery({
    queryKey: ['ing-docs', effectiveObraId],
    queryFn: async () => effectiveObraId ? base44.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: effectiveObraId }, '-created_date', 100) : [],
    enabled: !!effectiveObraId,
  });

  const onFile = (file) => {
    setArchivo(file);
    setAutoInfo('');
    if (!file) return;
    const detTipo = detectTipo(file.name);
    const detRev = detectRevision(file.name);
    const detObra = matchObra(file.name, obras);
    const parts = [];
    if (detTipo) { setTipo(detTipo); parts.push(`tipo: ${detTipo.replace(/_/g, ' ')}`); }
    if (detRev) { setRevision(detRev); parts.push(`rev: ${detRev}`); }
    if (detObra) { setObraId(detObra.id); parts.push(`proyecto: ${detObra.name}`); }
    if (parts.length) setAutoInfo(`Detectado del nombre de archivo — ${parts.join(' · ')}. Revisa antes de procesar.`);
  };

  // Re-deriva ítems/fichas de un documento (compartido por alta, duplicado y precisión).
  const derivarDeDocumento = async (docId, tipoDoc, datos, revFinal) => {
    let derivados = 0;
    if (tipoDoc === 'listado_puntos' || tipoDoc === 'lista_material') {
      const dominio = obra?.disciplina_ingenieria === 'bms' ? 'control_bms' : 'material_electrico_proceso';
      const existentes = await base44.entities.ItemLista.filter({ documento_origen_id: docId });
      if (existentes.length) await base44.entities.ItemLista.deleteMany({ documento_origen_id: docId });
      const items = (datos.puntos || []).filter(p => p.descripcion).map(p => ({
        obra_id: effectiveObraId, documento_origen_id: docId, revision: revFinal,
        tag: p.punto_id || '', dominio, descripcion: p.descripcion, zona: p.ubicacion || '',
        referencia_equipo: p.referencia || '', fabricante_name: p.fabricante || '',
        cantidad: p.cantidad || 1, unidad: p.unidad || 'ud', confianza: datos.confianza || 'media',
        estado: 'pendiente_revision',
      }));
      if (items.length) { await base44.entities.ItemLista.bulkCreate(items); derivados = items.length; }
    } else if (tipoDoc === 'ficha_tecnica_equipo') {
      const existentes = await base44.entities.FichaTecnicaEquipo.filter({ documento_origen_id: docId });
      const payload = {
        tag_equipo: datos.tag_equipo || '', equipo_tipo: datos.equipo_tipo || 'otro',
        fabricante: datos.fabricante || '', modelo: datos.modelo || '',
        especificacion_clave: datos.especificacion_clave || {}, equipo_asociado: datos.equipo_asociado || '',
        confianza: datos.confianza || 'media',
      };
      if (existentes.length) await base44.entities.FichaTecnicaEquipo.update(existentes[0].id, payload);
      else await base44.entities.FichaTecnicaEquipo.create({ ...payload, obra_id: effectiveObraId, documento_origen_id: docId, estado: 'pendiente_revision' });
      derivados = 1;
    }
    return derivados;
  };

  const reprocesar = async (d) => {
    const cfg = TIPO_OCR[d.tipo];
    if (!cfg || !d.archivo_url_mejorado) return;
    setPrecisionId(d.id); setPrecisionMsg(''); setPrecisionDiff(null);
    try {
      const viejo = d.datos_extraidos || {};
      const res = await base44.functions.invoke(cfg.fn, { file_url: d.archivo_url_mejorado, file_tipo: 'image/jpeg' });
      if (!res.data?.success) throw new Error(res.data?.error || 'OCR fallido');
      const datos = { ...res.data.datos, _file_sha256: viejo._file_sha256 || '' };
      const nuevaRev = d.revision || datos.revision || '';
      const diff = diffDatos(viejo, datos);
      await base44.entities.MaterialDocumentoOrigen.update(d.id, {
        revision: nuevaRev,
        numero_documento: datos.numero_documento || d.numero_documento || '',
        proveedor_nombre: datos.proveedor || d.proveedor_nombre || '',
        datos_extraidos: datos,
        estado: 'procesado',
      });
      const derivados = await derivarDeDocumento(d.id, d.tipo, datos, nuevaRev);
      qc.invalidateQueries({ queryKey: ['ing-docs', effectiveObraId] });
      setPrecisionDiff(diff);
      setPrecisionMsg(`Re-análisis OK: ${d.numero_documento || d.tipo} · ${derivados} derivado(s) · ${diff.length} cambio(s) (${res.data.modelo}${res.data.fallback ? ' · fallback' : ''})`);
    } catch (e) {
      setPrecisionMsg(`Error re-analizando ${d.numero_documento || ''}: ${String(e?.message || e).slice(0, 200)}`);
    } finally { setPrecisionId(null); }
  };

  const reprocesarTodos = async () => {
    setPrecisionMsg('Re-analizando documentos…'); setPrecisionDiff(null);
    for (const d of documentos) {
      if (!d.archivo_url_mejorado) continue;
      await reprocesar(d);
    }
    setPrecisionMsg('Re-análisis completado.');
  };

  const procesar = async () => {
    if (!effectiveObraId || !archivo) return;
    const cfg = TIPO_OCR[tipo];
    setEstado('subiendo'); setError(''); setResultado(null);
    try {
      setEstado('ocr');
      const fileHash = await calcularHash(archivo);
      const up = await base44.integrations.Core.UploadPublicFile({ file: archivo });
      const file_url = up.file_url;
      const res = await base44.functions.invoke(cfg.fn, { file_url, file_tipo: archivo.type });
      if (!res.data?.success) throw new Error(res.data?.error || 'OCR fallido');
      const datos = { ...res.data.datos, _file_sha256: fileHash };
      setEstado('guardando');

      const dup = detectarDuplicado(fileHash, { ...datos, revision: revision || datos.revision || '' }, documentos);
      if (dup) {
        const viejo = dup.doc.datos_extraidos || {};
        const diff = diffDatos(viejo, datos);
        const revFinal = dup.doc.revision || datos.revision || '';
        await base44.entities.MaterialDocumentoOrigen.update(dup.doc.id, {
          revision: revFinal,
          numero_documento: datos.numero_documento || dup.doc.numero_documento || '',
          proveedor_nombre: datos.proveedor || dup.doc.proveedor_nombre || '',
          datos_extraidos: datos,
          estado: 'procesado',
          archivo_url_mejorado: file_url,
        });
        const derivados = await derivarDeDocumento(dup.doc.id, dup.doc.tipo, datos, revFinal);
        setResultado({ documentoId: dup.doc.id, derivados, confianza: datos.confianza, modelo: res.data.modelo, fallback: res.data.fallback, duplicado: true, motivo: dup.motivo, fuerza: dup.fuerza, diff });
      } else {
        const revFinal = revision || datos.revision || '';
        const doc = await base44.entities.MaterialDocumentoOrigen.create({
          tipo,
          proyecto_ingenieria_id: effectiveObraId,
          obra_id: effectiveObraId,
          revision: revFinal,
          numero_documento: datos.numero_documento || '',
          fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
          proveedor_nombre: datos.proveedor || '',
          estado: 'procesado',
          datos_extraidos: datos,
          archivo_url_mejorado: file_url,
          ingeniero_subido_por: user?.email || '',
        });
        const derivados = await derivarDeDocumento(doc.id, tipo, datos, revFinal);
        setResultado({ documentoId: doc.id, derivados, confianza: datos.confianza, modelo: res.data.modelo, fallback: res.data.fallback, duplicado: false, diff: [] });
      }
      setEstado('ok');
      setArchivo(null); setRevision('');
      qc.invalidateQueries({ queryKey: ['ing-docs', effectiveObraId] });
    } catch (e) {
      setError(String(e?.message || e).slice(0, 300));
      setEstado('error');
    }
  };

  return (
    <div>
      <PageHeader title="Carga de Documentos" subtitle="OCR especializado por tipo de documento" icon={Upload} />
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
            <ProyectoSelector value={effectiveObraId} onChange={setObraId} className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tipo de documento</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1 min-h-[40px]">
              {Object.entries(TIPO_OCR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Revisión (opcional)</label>
            <input value={revision} onChange={e => setRevision(e.target.value)} placeholder="R0, R3B, R717…" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1 min-h-[40px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Archivo (imagen o PDF)</label>
            <input type="file" accept="image/*,application/pdf" onChange={e => onFile(e.target.files?.[0] || null)} className="w-full text-sm mt-1" />
            {autoInfo && (
              <div className="mt-1.5 flex items-start gap-2 p-2 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>{autoInfo}</div>
              </div>
            )}
          </div>
          <button
            onClick={procesar}
            disabled={!effectiveObraId || !archivo || ['subiendo','ocr','guardando'].includes(estado)}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {['subiendo','ocr','guardando'].includes(estado) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {estado === 'subiendo' ? 'Subiendo…' : estado === 'ocr' ? 'Procesando OCR…' : estado === 'guardando' ? 'Guardando…' : 'Procesar documento'}
          </button>

          {estado === 'ok' && resultado && (
            <div className={`p-3 rounded-lg border text-sm ${resultado.duplicado ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-start gap-2">
                {resultado.duplicado ? <Copy className="w-5 h-5 text-amber-600 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                <div className="flex-1">
                  <div className={`font-medium ${resultado.duplicado ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {resultado.duplicado ? 'Duplicado detectado — documento actualizado' : 'Documento procesado'}
                  </div>
                  <div className={`text-xs mt-0.5 ${resultado.duplicado ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {resultado.duplicado
                      ? `Motivo: ${resultado.motivo} (fiabilidad ${resultado.fuerza}). No se creó duplicado; se re-procesó el existente. `
                      : ''}
                    {resultado.derivados > 0 ? `${resultado.derivados} registro(s) derivado(s). ` : ''}
                    Confianza: {resultado.confianza}. Modelo: {resultado.modelo}{resultado.fallback ? ' (fallback)' : ''}.
                  </div>
                </div>
              </div>
              <DiffList diff={resultado.diff} />
            </div>
          )}
          {estado === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-red-700 text-xs">{error}</div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-3 border-b border-border font-semibold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Documentos del proyecto
            <button onClick={reprocesarTodos} disabled={!!precisionId || documentos.length === 0} className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50 min-h-[32px]">
              <RefreshCw className={`w-3 h-3 ${precisionId ? 'animate-spin' : ''}`} /> Re-analizar todos
            </button>
          </div>
          {precisionMsg && (
            <div className="p-2 text-xs text-teal-700 bg-teal-50 border-b border-teal-200 flex items-start gap-1.5">
              {precisionId ? <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5" /> : <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
              <span>{precisionMsg}</span>
            </div>
          )}
          {precisionDiff && precisionDiff.length > 0 && (
            <div className="p-2 border-b border-amber-200 bg-amber-50">
              <DiffList diff={precisionDiff} max={20} />
            </div>
          )}
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {documentos.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin documentos.</div>}
            {documentos.map(d => (
              <div key={d.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">{d.tipo.replace(/_/g, ' ')}</span>
                  {d.revision && <span className="text-xs text-muted-foreground">Rev. {d.revision}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${d.estado === 'superseded' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{d.estado}</span>
                </div>
                <div className="text-sm mt-1">{d.numero_documento || d.proveedor_nombre || 'Documento sin número'}</div>
                <div className="text-xs text-muted-foreground">{d.fecha_documento} · {d.lineas_count || 0} líneas</div>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => reprocesar(d)} disabled={precisionId === d.id || !d.archivo_url_mejorado} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50 min-h-[32px]">
                    {precisionId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Precisión
                  </button>
                  {d.archivo_url_mejorado && <a href={d.archivo_url_mejorado} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">ver archivo</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}