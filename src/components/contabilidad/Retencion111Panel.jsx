/**
 * Retencion111Panel.jsx
 * ═══════════════════════════════════════════════════════════════
 * Panel completo de gestión de retenciones IRPF (Modelo 111).
 *
 * FLUJO DE SUBIDA (gerencia/administración):
 *   1. Arrastrar o seleccionar PDF/imagen de factura autónomo
 *   2. El frontend sube el archivo con UploadPrivateFile (almacenamiento privado)
 *   3. Llama a procesarFacturaAutonomo, que crea el registro tras el OCR
 *   4. Si confianza alta → datos auto-rellenados. Si baja → marca revisión
 *
 * FLUJO DE DESCARGA (contabilidad externa):
 *   1. Selecciona trimestre → Generar informe 111
 *   2. Ve tabla con autónomos + resumen trabajadores
 *   3. Descarga texto plano / copia casillas del modelo 111
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import {
  Upload, Loader2, CheckCircle2, AlertCircle, AlertTriangle,
  FileText, Download, Copy, Eye, Pencil, Trash2,
  ChevronDown, ChevronRight, Receipt, Users, Building2,
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fmtPct = (n) => `${(n ?? 0).toFixed(2)}%`;

function calcTrimestreActual() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-T${q}`;
}

const TRIMESTRES_LABEL = ['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'];
const ESTADOS_FACTURA = ['borrador', 'pendiente_pago', 'pagada', 'incluida_111', 'anulada'];
const ESTADO_COLORS = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_pago: 'bg-yellow-100 text-yellow-800',
  pagada: 'bg-green-100 text-green-800',
  incluida_111: 'bg-blue-100 text-blue-800',
  anulada: 'bg-red-100 text-red-700',
};

// Abre un archivo privado generando una URL firmada temporal
async function abrirFacturaPrivada(file_uri) {
  try {
    const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 300 });
    if (signed?.signed_url) {
      window.open(signed.signed_url, '_blank');
    } else {
      toast.error('No se pudo generar el enlace del archivo');
    }
  } catch (e) {
    toast.error('No se pudo abrir el archivo');
  }
}

// ── Fila de factura autónomo ────────────────────────────────────────────────
function FacturaRow({ factura, puedeEditar, onEditar, onCambiarEstado, onEliminar, onVer }) {
  const [expandida, setExpandida] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden mb-2 ${factura.precisa_revision ? 'border-amber-300' : 'border-border'}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpandida(!expandida)}>
        {expandida
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{factura.nombre_autonomo || 'Sin nombre'}</span>
            <code className="text-xs text-muted-foreground font-mono">{factura.nif_autonomo || '—'}</code>
            {factura.precisa_revision && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Revisar
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
            <span>{factura.fecha_factura || '—'}</span>
            <span>·</span>
            <span>Fac. {factura.numero_factura || '—'}</span>
            <span>·</span>
            <span className="text-foreground font-medium">Ret: {fmt(factura.importe_retencion)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold font-mono text-sm">{fmt(factura.base_imponible)}</div>
          <div className="text-xs text-muted-foreground">{fmtPct(factura.porcentaje_retencion)} ret.</div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ESTADO_COLORS[factura.estado] || ESTADO_COLORS.borrador}`}>
          {factura.estado || 'borrador'}
        </span>
      </div>

      {expandida && (
        <div className="px-4 pb-3 pt-1 border-t bg-muted/10 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ['Base imponible', fmt(factura.base_imponible)],
              ['IVA', `${factura.tipo_iva || 0}% = ${fmt(factura.importe_iva)}`],
              ['Retención IRPF', `${fmtPct(factura.porcentaje_retencion)} = ${fmt(factura.importe_retencion)}`],
              ['Total factura', fmt(factura.total_factura)],
            ].map(([label, valor]) => (
              <div key={label} className="bg-background rounded-lg p-2 border">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <div className="font-bold font-mono text-sm">{valor}</div>
              </div>
            ))}
          </div>
          {factura.concepto && (
            <p className="text-xs text-muted-foreground">Concepto: {factura.concepto}</p>
          )}
          {factura.revision_motivo && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {factura.revision_motivo}
            </div>
          )}
          {factura.notas && (
            <p className="text-xs text-muted-foreground italic">{factura.notas}</p>
          )}
          <div className="flex gap-2 flex-wrap pt-1">
            {factura.file_url && (
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7"
                onClick={() => onVer(factura.file_url)}>
                <Eye className="w-3 h-3" /> Ver factura
              </Button>
            )}
            {puedeEditar && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => onEditar(factura)}>
                  <Pencil className="w-3 h-3" /> Editar datos
                </Button>
                <MobileSelect value={factura.estado || 'borrador'}
                  onValueChange={(v) => onCambiarEstado(factura.id, v)}
                  placeholder="Cambiar estado"
                  triggerClassName="h-7 text-xs w-36">
                  {ESTADOS_FACTURA.map(e => <MobileSelectItem key={e} value={e}>{e}</MobileSelectItem>)}
                </MobileSelect>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onEliminar(factura.id)}>
                  <Trash2 className="w-3 h-3" /> Eliminar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function Retencion111Panel() {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puedeSubir = isAdministracion || isGerencia || isAdmin;
  const puedeEditar = isAdministracion || isGerencia || isAdmin;
  const puedeDescargar = isContabilidad || isAdministracion || isGerencia || isAdmin;
  const qc = useQueryClient();

  const [subTab, setSubTab] = useState(puedeSubir ? 'facturas' : 'informe');
  const [trimestre, setTrimestre] = useState(calcTrimestreActual);
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [informe, setInforme] = useState(null);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const inputRef = useRef(null);

  // ── Query facturas ────────────────────────────────────────────────────────
  const { data: facturas = [], isLoading: loadingFacturas } = useQuery({
    queryKey: ['facturas-autonomo', trimestre],
    queryFn: async () => {
      const todas = await base44.entities.FacturaAutonomo.list('fecha_factura', 200);
      return (todas || []).filter(f => !trimestre || f.trimestre === trimestre);
    },
    staleTime: 30000,
  });

  const facturasFiltradas = filtroEstado === 'todos'
    ? facturas
    : filtroEstado === 'revision'
      ? facturas.filter(f => f.precisa_revision)
      : facturas.filter(f => f.estado === filtroEstado);

  // ── Subir y procesar factura ──────────────────────────────────────────────
  const subirYProcesar = useCallback(async (files) => {
    if (!puedeSubir || !files || files.length === 0) return;
    setSubiendo(true);
    let procesados = 0;
    let errores = 0;

    for (const file of Array.from(files)) {
      try {
        // 1. Subir a almacenamiento PRIVADO
        const subida = await base44.integrations.Core.UploadPrivateFile({ file });
        const file_uri = subida?.file_uri;
        if (!file_uri) throw new Error('No se pudo subir el archivo');

        // 2. Procesar con OCR+LLM (el backend crea el registro)
        const res = await base44.functions.invoke('procesarFacturaAutonomo', {
          file_uri,
          nombre: file.name,
          tipo: file.type,
        });
        const data = res?.data || res;

        if (data?.ok) {
          procesados++;
          if (data.precisa_revision) {
            toast.warning(`${file.name}: datos extraídos con baja confianza — revisar`, { duration: 5000 });
          } else {
            toast.success(`${file.name}: procesada correctamente`);
          }
        } else {
          throw new Error(data?.error || 'Error en procesamiento');
        }
      } catch (e) {
        errores++;
        toast.error(`Error en ${file.name}: ${e?.message || 'Error desconocido'}`);
      }
    }

    setSubiendo(false);
    if (procesados > 0) {
      qc.invalidateQueries({ queryKey: ['facturas-autonomo'] });
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [puedeSubir, qc]);

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await base44.entities.FacturaAutonomo.update(id, { estado: nuevoEstado });
      qc.invalidateQueries({ queryKey: ['facturas-autonomo'] });
      toast.success(`Estado actualizado a "${nuevoEstado}"`);
    } catch (e) {
      toast.error('Error al cambiar estado');
    }
  };

  // ── Eliminar factura ──────────────────────────────────────────────────────
  const eliminarFactura = async (id) => {
    if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
    try {
      await base44.entities.FacturaAutonomo.delete(id);
      qc.invalidateQueries({ queryKey: ['facturas-autonomo'] });
      toast.success('Factura eliminada');
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  // ── Guardar edición manual ────────────────────────────────────────────────
  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      const base = Number(editando.base_imponible) || 0;
      const pct = Number(editando.porcentaje_retencion) || 0;
      const ivaImp = Number(editando.importe_iva) || 0;
      const ret = base * (pct / 100);
      const total = base + ivaImp - ret;
      const trim = editando.fecha_factura
        ? `${new Date(editando.fecha_factura).getFullYear()}-T${Math.ceil((new Date(editando.fecha_factura).getMonth() + 1) / 3)}`
        : editando.trimestre;
      await base44.entities.FacturaAutonomo.update(editando.id, {
        nombre_autonomo: editando.nombre_autonomo || '',
        nif_autonomo: editando.nif_autonomo || '',
        numero_factura: editando.numero_factura || '',
        fecha_factura: editando.fecha_factura,
        concepto: editando.concepto || '',
        base_imponible: base,
        porcentaje_retencion: pct,
        importe_retencion: ret,
        tipo_iva: Number(editando.tipo_iva) || 0,
        importe_iva: ivaImp,
        total_factura: total,
        trimestre: trim,
        notas: editando.notas || '',
        precisa_revision: false,
        revision_motivo: '',
        ocr_status: 'procesado',
      });
      qc.invalidateQueries({ queryKey: ['facturas-autonomo'] });
      setEditando(null);
      toast.success('Factura actualizada');
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  // ── Generar informe 111 ───────────────────────────────────────────────────
  const generarInforme = async () => {
    if (!puedeDescargar) return;
    setGenerandoInforme(true);
    try {
      const res = await base44.functions.invoke('exportarInforme111', {
        trimestre,
        incluir_trabajadores: true,
      });
      const data = res?.data || res;
      if (!data?.ok) throw new Error(data?.error || 'Error generando informe');
      setInforme(data);
      toast.success('Informe 111 generado');
    } catch (e) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setGenerandoInforme(false);
    }
  };

  const copiarInforme = () => {
    if (!informe?.informe_texto) return;
    navigator.clipboard.writeText(informe.informe_texto);
    toast.success('Informe copiado al portapapeles');
  };

  const descargarInforme = () => {
    if (!informe?.informe_texto) return;
    const blob = new Blob([informe.informe_texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_111_${trimestre}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Descargando informe...');
  };

  // Totales del trimestre actual
  const totalBase = facturas.reduce((s, f) => s + (f.base_imponible || 0), 0);
  const totalRetencion = facturas.reduce((s, f) => s + (f.importe_retencion || 0), 0);
  const pendRevision = facturas.filter(f => f.precisa_revision).length;

  // ── Trimestre selector ────────────────────────────────────────────────────
  const anioActual = new Date().getFullYear();
  const trimestresDisp = [];
  for (let y = anioActual; y >= anioActual - 2; y--) {
    for (let q = 4; q >= 1; q--) {
      trimestresDisp.push({ value: `${y}-T${q}`, label: `${y} · T${q} (${TRIMESTRES_LABEL[q - 1]})` });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header con selector de trimestre */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Modelo 111 — Retenciones</span>
        </div>
        <MobileSelect value={trimestre} onValueChange={setTrimestre}
          placeholder="Seleccionar trimestre" triggerClassName="w-56 text-sm">
          {trimestresDisp.map(t => <MobileSelectItem key={t.value} value={t.value}>{t.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* KPIs del trimestre */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Facturas autónomos', val: facturas.length, cls: 'text-blue-700', icon: FileText },
          { label: 'Base total', val: fmt(totalBase), cls: 'text-foreground', icon: Building2 },
          { label: 'Total retención 111', val: fmt(totalRetencion), cls: 'text-red-700', icon: Receipt },
          { label: 'Pendientes de revisión', val: pendRevision, cls: pendRevision > 0 ? 'text-amber-700' : 'text-green-700', icon: AlertTriangle },
        ].map(({ label, val, cls, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Icon className="w-3.5 h-3.5" />{label}
              </div>
              <div className={`font-bold text-lg font-mono ${cls}`}>{val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pestañas principales */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          {puedeSubir && (
            <TabsTrigger value="facturas" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Facturas autónomos
            </TabsTrigger>
          )}
          <TabsTrigger value="informe" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Informe 111
          </TabsTrigger>
        </TabsList>

        {/* ── PESTAÑA: FACTURAS ────────────────────────────────────────── */}
        {puedeSubir && (
          <TabsContent value="facturas" className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <label
                  className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); subirYProcesar(e.dataTransfer.files); }}>
                  {subiendo
                    ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    : <Upload className="w-8 h-8 text-primary" />}
                  <div className="text-center">
                    <p className="font-semibold text-sm text-primary">
                      {subiendo ? 'Procesando con OCR+LLM...' : 'Arrastra facturas de autónomos aquí'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF o imagen · Se detectan automáticamente: NIF, base, % retención, fecha
                    </p>
                  </div>
                  <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="sr-only"
                    onChange={e => subirYProcesar(e.target.files)} />
                </label>
              </CardContent>
            </Card>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              {['todos', 'revision', 'borrador', 'pagada', 'incluida_111'].map(f => (
                <button key={f} onClick={() => setFiltroEstado(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filtroEstado === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted'
                  }`}>
                  {f === 'revision' ? '⚠ Revisar' : f === 'todos' ? 'Todas' : f}
                  {f === 'revision' && pendRevision > 0 && (
                    <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-[9px]">{pendRevision}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Lista de facturas */}
            {loadingFacturas ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando facturas...</span>
              </div>
            ) : facturasFiltradas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {filtroEstado === 'todos'
                  ? 'No hay facturas de autónomos para este trimestre. Sube la primera usando la zona de arriba.'
                  : `No hay facturas con estado "${filtroEstado}" en este trimestre.`}
              </div>
            ) : (
              facturasFiltradas.map(f => (
                <FacturaRow key={f.id} factura={f}
                  puedeEditar={puedeEditar}
                  onEditar={setEditando}
                  onCambiarEstado={cambiarEstado}
                  onEliminar={eliminarFactura}
                  onVer={abrirFacturaPrivada} />
              ))
            )}
          </TabsContent>
        )}

        {/* ── PESTAÑA: INFORME 111 ─────────────────────────────────────── */}
        <TabsContent value="informe" className="space-y-4">
          {!puedeDescargar ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
              Sin permisos para generar informes 111.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Trimestre</Label>
                      <MobileSelect value={trimestre} onValueChange={setTrimestre}
                        placeholder="Trimestre" triggerClassName="w-56 text-sm">
                        {trimestresDisp.map(t => <MobileSelectItem key={t.value} value={t.value}>{t.label}</MobileSelectItem>)}
                      </MobileSelect>
                    </div>
                    <Button onClick={generarInforme} disabled={generandoInforme} className="gap-2">
                      {generandoInforme
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
                        : <><Receipt className="w-4 h-4" />Generar informe 111</>}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Consolida retenciones de autónomos (Mod. 111 casillas 04-06) + trabajadores empleados (casillas 01-03) del trimestre seleccionado.
                  </p>
                </CardContent>
              </Card>

              {informe && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-primary" />
                        Preview casillas Modelo 111 — {informe.trimestre}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {informe.facturas_pendientes_revision > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            <strong>{informe.facturas_pendientes_revision} factura{informe.facturas_pendientes_revision !== 1 ? 's' : ''}</strong> pendiente{informe.facturas_pendientes_revision !== 1 ? 's' : ''} de revisión.
                            Revisa y corrige antes de presentar la declaración.
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Trabajadores */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-blue-700" />
                            <span className="font-semibold text-sm text-blue-800">Rendimientos del trabajo</span>
                          </div>
                          {[
                            ['[01] Perceptores', informe.modelo111_preview.casilla_01_perceptores_trabajo],
                            ['[02] Base íntegra', fmt(informe.modelo111_preview.casilla_02_base_trabajo)],
                            ['[03] Retenciones', fmt(informe.modelo111_preview.casilla_03_retencion_trabajo)],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between text-sm py-1 border-b border-blue-200 last:border-0">
                              <span className="text-blue-700">{label}</span>
                              <span className="font-bold font-mono text-blue-900">{val}</span>
                            </div>
                          ))}
                        </div>

                        {/* Autónomos */}
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="w-4 h-4 text-orange-700" />
                            <span className="font-semibold text-sm text-orange-800">Actividades profesionales (autónomos)</span>
                          </div>
                          {[
                            ['[04] Perceptores', informe.modelo111_preview.casilla_04_perceptores_profesional],
                            ['[05] Base íntegra', fmt(informe.modelo111_preview.casilla_05_base_profesional)],
                            ['[06] Retenciones', fmt(informe.modelo111_preview.casilla_06_retencion_profesional)],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between text-sm py-1 border-b border-orange-200 last:border-0">
                              <span className="text-orange-700">{label}</span>
                              <span className="font-bold font-mono text-orange-900">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between p-4 bg-red-600 text-white rounded-xl">
                        <span className="font-bold text-base">[28] TOTAL A INGRESAR — Modelo 111</span>
                        <span className="font-bold text-2xl font-mono">
                          {fmt(informe.modelo111_preview.casilla_28_total_ingresar)}
                        </span>
                      </div>

                      {/* Detalle autónomos */}
                      {informe.autonomos?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Detalle por autónomo</p>
                          {informe.autonomos.map(a => (
                            <div key={a.nif_autonomo} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{a.nombre_autonomo}</span>
                                <code className="text-xs text-muted-foreground ml-2 font-mono">{a.nif_autonomo}</code>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono text-xs text-muted-foreground">Base: {fmt(a.total_base)}</div>
                                <div className="font-bold font-mono text-sm text-red-700">Ret: {fmt(a.total_retencion)}</div>
                              </div>
                              <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(a.porcentaje_medio)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Botones de descarga */}
                  <div className="flex gap-3 flex-wrap">
                    <Button variant="outline" className="gap-2" onClick={copiarInforme}>
                      <Copy className="w-4 h-4" /> Copiar informe
                    </Button>
                    <Button className="gap-2" onClick={descargarInforme}>
                      <Download className="w-4 h-4" /> Descargar .txt
                    </Button>
                  </div>

                  {/* Texto completo */}
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs text-muted-foreground">Informe completo (texto plano)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-3 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                        {informe.informe_texto}
                      </pre>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal edición manual */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 p-5 border-b">
              <Pencil className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-base">Editar factura autónomo</h3>
                <p className="text-xs text-muted-foreground">Corrige los datos extraídos por OCR</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {[
                ['Nombre/Razón social', 'nombre_autonomo', 'text'],
                ['NIF/DNI/NIE del autónomo', 'nif_autonomo', 'text'],
                ['Número de factura', 'numero_factura', 'text'],
                ['Fecha de factura', 'fecha_factura', 'date'],
                ['Concepto', 'concepto', 'text'],
                ['Base imponible (€)', 'base_imponible', 'number'],
                ['% Retención IRPF', 'porcentaje_retencion', 'number'],
                ['Tipo IVA (%)', 'tipo_iva', 'number'],
                ['Importe IVA (€)', 'importe_iva', 'number'],
              ].map(([label, campo, tipo]) => (
                <div key={campo}>
                  <Label className="text-xs font-medium">{label}</Label>
                  <Input type={tipo} value={editando[campo] ?? ''}
                    onChange={e => setEditando(prev => ({
                      ...prev,
                      [campo]: tipo === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                    }))}
                    className="mt-1 h-8 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs font-medium">Notas internas</Label>
                <textarea value={editando.notas || ''}
                  onChange={e => setEditando(prev => ({ ...prev, notas: e.target.value }))}
                  className="w-full mt-1 text-sm border rounded-md p-2 min-h-16 bg-background resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button className="flex-1 gap-1.5" onClick={guardarEdicion}>
                <CheckCircle2 className="w-4 h-4" /> Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}