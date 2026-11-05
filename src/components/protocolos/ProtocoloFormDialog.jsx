import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { subirArchivo } from '@/lib/subirArchivo';
import { toast } from 'sonner';
import { Loader2, Upload, Save, Sparkles, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { AREAS, CARACTERES, CONFIDENCIALIDADES, VIGENCIAS, opciones } from '@/lib/protocolosCatalogo';

const vacio = {
  titulo: '', descripcion: '', resumen: '',
  area: '', caracter: '', confidencialidad: 'general', vigencia: 'vivo',
  version: '', fecha_documento: '', fecha_revision: '',
  file_url: '', drive_file_id: '', nombre_archivo: '', mime_type: '',
  etiquetas: [], clasificado_auto: false, confianza_clasificacion: null,
  activo: true, notas_internas: '',
};

const CRITERIOS = `Criterios de clasificación documental de la empresa:
1) Área funcional (campo "area"): rrhh = Recursos Humanos (contratación, igualdad, PRL, conducta, acogida, organigramas, control horario); legal_compliance = Legal y Cumplimiento (RGPD, antifraude, canal de denuncias, actas de administración); finanzas_administracion = Finanzas y Administración (presupuestos, gastos de viaje, facturación, flujos de caja); operaciones_ti = Operaciones y Tecnología TI (procesos operativos, seguridad informática, dispositivos, guías de sistemas).
2) Carácter normativo (campo "caracter"): politica_obligatoria = política o normativa de obligado cumplimiento aprobada por Dirección, su incumplimiento puede sancionarse; procedimiento_sop = manual que explica paso a paso cómo hacer un proceso; informativo = circular interna, comunicado, newsletter o anuncio.
3) Confidencialidad (campo "confidencialidad"): general = accesible a toda la plantilla; restringido = solo empleados, sin datos altamente sensibles; confidencial = estratégico, financiero o de RRHH reservado a dirección, gerencia o departamentos autorizados (expedientes, nóminas, planes estratégicos).
4) Soporte y vigencia (campo "vigencia"): vivo = documento sujeto a revisiones y actualizaciones periódicas; historico = documentación de conservación obligada en archivo (p. ej. registros de control horario, 4 años).`;

const ESQUEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Título corto y descriptivo del documento' },
    resumen: { type: 'string', description: 'Resumen de 2 o 3 frases sobre el contenido' },
    area: { type: 'string', enum: ['rrhh', 'legal_compliance', 'finanzas_administracion', 'operaciones_ti'] },
    caracter: { type: 'string', enum: ['politica_obligatoria', 'procedimiento_sop', 'informativo'] },
    confidencialidad: { type: 'string', enum: ['general', 'restringido', 'confidencial'] },
    vigencia: { type: 'string', enum: ['vivo', 'historico'] },
    version: { type: 'string' },
    fecha_documento: { type: 'string', description: 'Fecha del documento en formato YYYY-MM-DD, vacío si no aparece' },
    etiquetas: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'number', description: 'Confianza global de la clasificación entre 0 y 1' },
  },
  required: ['titulo', 'area', 'caracter', 'confidencialidad', 'vigencia'],
};

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export default function ProtocoloFormDialog({ open, onOpenChange, protocolo, onSaved }) {
  const [form, setForm] = useState(vacio);
  const [subiendo, setSubiendo] = useState(false);
  const [clasificando, setClasificando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(protocolo ? { ...vacio, ...protocolo } : vacio);
  }, [open, protocolo]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const clasificar = async (url) => {
    setClasificando(true);
    try {
      const r = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres el archivo documental de una empresa de instalaciones industriales y energía solar. Analiza el documento adjunto y clasifícalo según los criterios internos.\n\n${CRITERIOS}\n\nDevuelve además un título representativo, un resumen breve, la versión si aparece, la fecha del documento y 3-6 etiquetas de palabras clave. Si el documento no es legible, devuelve el título con el nombre del archivo y confianza 0.`,
        file_urls: [url],
        response_json_schema: ESQUEMA,
      });
      const d = r || {};
      setForm(p => ({
        ...p,
        titulo: p.titulo || d.titulo || p.nombre_archivo || '',
        resumen: d.resumen || p.resumen,
        area: d.area || p.area,
        caracter: d.caracter || p.caracter,
        confidencialidad: d.confidencialidad || p.confidencialidad,
        vigencia: d.vigencia || p.vigencia,
        version: d.version || p.version,
        fecha_documento: esFecha(d.fecha_documento) ? d.fecha_documento : p.fecha_documento,
        etiquetas: Array.isArray(d.etiquetas) ? d.etiquetas.slice(0, 8) : p.etiquetas,
        clasificado_auto: true,
        confianza_clasificacion: typeof d.confianza === 'number' ? d.confianza : null,
      }));
      toast.success('Documento clasificado automáticamente. Revisa la propuesta.');
    } catch (e) {
      toast.warning('No se pudo clasificar automáticamente: completa la clasificación a mano.');
    } finally {
      setClasificando(false);
    }
  };

  const subir = async (file) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const res = await subirArchivo(file, {
        ruta_drive: 'Empresa/ProtocolosInternos',
        nombre: file.name,
        entidad_tipo: 'ProtocoloInterno',
      });
      const url = res?.cdn_url_para_llm || res?.file_url;
      if (!url) throw new Error('la subida no devolvió ninguna URL');
      setForm(p => ({
        ...p,
        file_url: res.file_url || url,
        drive_file_id: res.drive_file_id || '',
        nombre_archivo: file.name,
        mime_type: file.type || '',
      }));
      toast.success('Archivo subido. Clasificando el documento…');
      await clasificar(url);
    } catch (e) {
      toast.error('Error al subir el archivo: ' + (e.message || 'error desconocido'));
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const datos = { ...form };
      delete datos.id;
      delete datos.created_date;
      delete datos.updated_date;
      delete datos.created_by_id;
      delete datos.created_by;
      if (protocolo) {
        await base44.entities.ProtocoloInterno.update(protocolo.id, datos);
        toast.success('Documento actualizado');
      } else {
        const usuario = await base44.auth.me().catch(() => null);
        await base44.entities.ProtocoloInterno.create({
          ...datos,
          subido_por: usuario?.email || '',
          subido_por_nombre: usuario?.full_name || '',
        });
        toast.success('Documento publicado para la plantilla');
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error('No se pudo guardar el documento: ' + (e.message || 'sin permisos'));
    } finally {
      setGuardando(false);
    }
  };

  const listo = form.titulo.trim() && form.area && form.caracter && form.confidencialidad && form.vigencia;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{protocolo ? 'Editar protocolo interno' : 'Nuevo protocolo interno'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Archivo *</Label>
            <div className="flex gap-2">
              <Input value={form.nombre_archivo} readOnly placeholder="PDF, Word o imagen del documento" className="flex-1 text-xs" />
              <label className="cursor-pointer">
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={subiendo || clasificando} asChild>
                  <span>{subiendo || clasificando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                  onChange={e => e.target.files[0] && subir(e.target.files[0])}
                />
              </label>
            </div>
            {form.file_url && (
              <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary underline">
                Ver archivo subido
              </a>
            )}
            {clasificando && (
              <p className="text-[11px] text-indigo-600 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Analizando el documento para clasificarlo…
              </p>
            )}
            {form.clasificado_auto && !clasificando && (
              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 gap-1">
                <FileCheck2 className="w-2.5 h-2.5" />
                Clasificado automáticamente
                {form.confianza_clasificacion != null ? ` (${Math.round(form.confianza_clasificacion * 100)}%)` : ''}
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título *</Label>
            <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Protocolo de control horario" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Área funcional *</Label>
              <MobileSelect value={form.area || ''} onValueChange={v => set('area', v)} placeholder="Seleccionar área">
                {opciones(AREAS).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Carácter normativo *</Label>
              <MobileSelect value={form.caracter || ''} onValueChange={v => set('caracter', v)} placeholder="Seleccionar carácter">
                {opciones(CARACTERES).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confidencialidad *</Label>
              <MobileSelect value={form.confidencialidad || ''} onValueChange={v => set('confidencialidad', v)} placeholder="Seleccionar nivel">
                {opciones(CONFIDENCIALIDADES).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vigencia *</Label>
              <MobileSelect value={form.vigencia || ''} onValueChange={v => set('vigencia', v)} placeholder="Seleccionar vigencia">
                {opciones(VIGENCIAS).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Versión</Label>
              <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha del documento</Label>
              <Input type="date" value={form.fecha_documento} onChange={e => set('fecha_documento', e.target.value)} />
            </div>
          </div>

          {form.vigencia === 'vivo' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Próxima revisión</Label>
              <Input type="date" value={form.fecha_revision} onChange={e => set('fecha_revision', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción (visible en el listado)</Label>
            <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Resumen del contenido</Label>
            <Textarea value={form.resumen} onChange={e => set('resumen', e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas internas (solo gerencia y administración)</Label>
            <Textarea value={form.notas_internas} onChange={e => set('notas_internas', e.target.value)} rows={2} />
          </div>

          {protocolo && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="h-4 w-4" checked={form.activo !== false} onChange={e => set('activo', e.target.checked)} />
              Documento activo (si lo desmarcas se archiva y deja de mostrarse a la plantilla)
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!listo || guardando || clasificando} className="gap-2 min-w-28">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {protocolo ? 'Guardar' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}