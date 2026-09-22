import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ProyectoSelector from '@/components/ingenieria/ProyectoSelector';
import { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import PageHeader from '@/components/layout/PageHeader';

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

  const obra = obras.find(o => o.id === obraId);
  const effectiveObraId = obraId || obras[0]?.id;

  const { data: documentos = [] } = useQuery({
    queryKey: ['ing-docs', effectiveObraId],
    queryFn: async () => effectiveObraId ? base44.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: effectiveObraId }, '-created_date', 100) : [],
    enabled: !!effectiveObraId,
  });

  const procesar = async () => {
    if (!effectiveObraId || !archivo) return;
    const cfg = TIPO_OCR[tipo];
    setEstado('subiendo'); setError(''); setResultado(null);
    try {
      const up = await base44.integrations.Core.UploadPublicFile({ file: archivo });
      const file_url = up.file_url;
      setEstado('ocr');
      const res = await base44.functions.invoke(cfg.fn, { file_url, file_tipo: archivo.type });
      if (!res.data?.success) throw new Error(res.data?.error || 'OCR fallido');
      const datos = res.data.datos;
      setEstado('guardando');
      const doc = await base44.entities.MaterialDocumentoOrigen.create({
        tipo,
        proyecto_ingenieria_id: effectiveObraId,
        obra_id: effectiveObraId,
        revision: revision || datos.revision || '',
        numero_documento: datos.numero_documento || '',
        fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
        proveedor_nombre: datos.proveedor || '',
        estado: 'procesado',
        datos_extraidos: datos,
        archivo_url_mejorado: file_url,
        ingeniero_subido_por: user?.email || '',
      });

      let derivados = 0;
      if (tipo === 'listado_puntos' || tipo === 'lista_material') {
        const dominio = obra?.disciplina_ingenieria === 'bms' ? 'control_bms' : 'material_electrico_proceso';
        const items = (datos.puntos || []).filter(p => p.descripcion).map(p => ({
          obra_id: effectiveObraId,
          documento_origen_id: doc.id,
          revision: revision || datos.revision || '',
          tag: p.punto_id || '',
          dominio,
          descripcion: p.descripcion,
          zona: p.ubicacion || '',
          referencia_equipo: p.referencia || '',
          fabricante_name: p.fabricante || '',
          cantidad: p.cantidad || 1,
          unidad: p.unidad || 'ud',
          confianza: datos.confianza || 'media',
          estado: 'pendiente_revision',
        }));
        if (items.length) { await base44.entities.ItemLista.bulkCreate(items); derivados = items.length; }
      } else if (tipo === 'ficha_tecnica_equipo') {
        await base44.entities.FichaTecnicaEquipo.create({
          obra_id: effectiveObraId,
          documento_origen_id: doc.id,
          tag_equipo: datos.tag_equipo || '',
          equipo_tipo: datos.equipo_tipo || 'otro',
          fabricante: datos.fabricante || '',
          modelo: datos.modelo || '',
          especificacion_clave: datos.especificacion_clave || {},
          equipo_asociado: datos.equipo_asociado || '',
          confianza: datos.confianza || 'media',
          estado: 'pendiente_revision',
        });
        derivados = 1;
      }
      setResultado({ documentoId: doc.id, derivados, confianza: datos.confianza, modelo: res.data.modelo, fallback: res.data.fallback });
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
            <input type="file" accept="image/*,application/pdf" onChange={e => setArchivo(e.target.files?.[0] || null)} className="w-full text-sm mt-1" />
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
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-medium text-emerald-800">Documento procesado</div>
                <div className="text-emerald-700 text-xs mt-0.5">
                  {resultado.derivados > 0 ? `${resultado.derivados} registro(s) derivado(s). ` : ''}Confianza: {resultado.confianza}. Modelo: {resultado.modelo}{resultado.fallback ? ' (fallback)' : ''}.
                </div>
              </div>
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
          <div className="p-3 border-b border-border font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos del proyecto</div>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}