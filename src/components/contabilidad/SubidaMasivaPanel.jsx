import { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, UploadCloud, AlertTriangle, CheckCircle2, FileText, Link2, Copy, X } from 'lucide-react';
import { extraerDatosGasto, evaluarPrecision } from '@/lib/ocrGastos';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const puedeEmpresa = (r) => r?.role === 'admin' || r?.role === 'propietario' || r?.role === 'gerencia' || r?.role === 'administracion';

function normComercio(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 40);
}

/**
 * Duplicado = misma fecha + mismo comercio (normalizado) + mismo importe (exacto).
 * HORA: si AMBOS documentos tienen hora y difieren → NO es duplicado (peajes de
 * tramos sucesivos el mismo día, mismo importe, mismo comercio). Si alguno no
 * trae hora, se considera duplicado si coinciden fecha+comercio+importe.
 */
function esDuplicado(a, b) {
  if (!a || !b) return false;
  if ((a.fecha_documento || '') !== (b.fecha_documento || '')) return false;
  if (normComercio(a.nombre_comercio) !== normComercio(b.nombre_comercio)) return false;
  if (Math.abs(Number(a.importe || 0) - Number(b.importe || 0)) > 0.001) return false;
  const ha = (a.hora_documento || '').trim();
  const hb = (b.hora_documento || '').trim();
  if (ha && hb && ha !== hb) return false;
  return true;
}

/**
 * Subida masiva v2 — un mismo motor de extracción (OCR), dos destinos:
 *  1) Mis gastos a recuperar → origen_pago medios_propios, estado borrador (reembolso).
 *  2) Facturas/tickets recibidos por la empresa → medio_empresa/credito_proveedor,
 *     estado 'registrado' (sin aprobación de reembolso, listo para contabilidad).
 * Detección de duplicados intra-lote + contra BD (fecha+comercio+importe+hora).
 */
export default function SubidaMasivaPanel() {
  const { user } = useUserRole();
  const qc = useQueryClient();
  const [destino, setDestino] = useState('propios'); // 'propios' | 'empresa'
  const [origenEmpresa, setOrigenEmpresa] = useState('medio_empresa'); // 'medio_empresa' | 'credito_proveedor'
  const [operarioId, setOperarioId] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState([]); // {nombre, estado, detalle, id?, datos?, referencia?}
  const inputRef = useRef(null);

  const verEmpresa = useMemo(() => puedeEmpresa(user), [user]);

  // Si el usuario cambia a destino empresa sin permiso, reset
  if (destino === 'empresa' && !verEmpresa) setDestino('propios');

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-activos-subida'],
    queryFn: async () => base44.entities.Operario.filter({ active: true }, 'name', 200),
  });

  // Pre-seleccionar el operario vinculado al usuario actual
  const vinculado = useMemo(() => operarios.find(o => o.user_email === user?.email), [operarios, user?.email]);
  if (!operarioId && vinculado) setOperarioId(vinculado.id);

  const onPick = (e) => { setArchivos(Array.from(e.target.files || [])); setResultados([]); };
  const onDrop = (e) => { e.preventDefault(); setArchivos(Array.from(e.dataTransfer.files || [])); setResultados([]); };

  const origenPago = destino === 'propios' ? 'medios_propios' : origenEmpresa;
  const estadoNacimiento = destino === 'propios' ? 'borrador' : 'registrado';

  const procesar = async () => {
    if (!operarioId) { toast.error('Selecciona un operario'); return; }
    if (!archivos.length) { toast.error('Añade al menos un archivo'); return; }
    const operario = operarios.find(o => o.id === operarioId);
    if (!operario) { toast.error('Operario no válido'); return; }
    if (destino === 'empresa' && !verEmpresa) { toast.error('Sin permiso para registrar facturas de empresa'); return; }

    setProcesando(true);
    setResultados([]);
    const res = [];
    const lote = []; // firmas extraídas para detección intra-lote

    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      const item = { nombre: file.name, estado: 'procesando', detalle: '' };
      res.push(item);
      setResultados([...res]);
      try {
        // 1. Subir a CDN
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        // 2. OCR (extrae hora_documento entre otros)
        const { datos, error } = await extraerDatosGasto(file_url);

        if (error || !datos) {
          // Sin OCR: crear en borrador/registrado con ia_no_disponible
          const payload = {
            operario_id: operario.id, operario_name: operario.name,
            operario_email: operario.user_email || user?.email || '',
            categoria: 'otros', importe: 0, estado: estadoNacimiento,
            origen_pago: origenPago, ocr_status: 'error', ia_no_disponible: true,
            archivos: [{ url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString() }],
            concepto: 'Subida masiva — OCR no disponible',
            fecha_documento: new Date().toISOString().slice(0, 10),
            numero_nota: `G-${Date.now().toString(36).toUpperCase()}`,
          };
          const created = await base44.entities.RegistroGasto.create(payload);
          item.estado = 'error_ocr'; item.detalle = error || 'Sin datos'; item.id = created.id;
          setResultados([...res]);
          continue;
        }

        // 3. Duplicado intra-lote
        const dupLote = lote.find((d, idx) => esDuplicado(datos, d.datos) ? d : null);
        if (dupLote) {
          item.estado = 'duplicado';
          item.detalle = `Duplicado de documento ${dupLote.idx + 1} (${res[dupLote.idx]?.nombre || ''})`;
          item.datos = datos; item.file_url = file_url;
          item.referencia = `lote:#${dupLote.idx + 1}`;
          setResultados([...res]);
          continue;
        }

        // 4. Duplicado contra BD (fecha + importe exactos, luego compara comercio+hora)
        let dupBD = null;
        try {
          const candidatos = await base44.entities.RegistroGasto.filter({
            fecha_documento: datos.fecha_documento,
            importe: Number(datos.importe) || 0,
          }, '-updated_date', 50);
          dupBD = candidatos.find(c => esDuplicado(datos, c));
        } catch {}

        if (dupBD) {
          item.estado = 'duplicado';
          item.detalle = `Duplicado de ${dupBD.numero_nota || dupBD.id} (${dupBD.nombre_comercio || ''})`;
          item.datos = datos; item.file_url = file_url;
          item.referencia = `bd:${dupBD.numero_nota || dupBD.id}`;
          setResultados([...res]);
          continue;
        }

        // 5. No duplicado → crear
        const { precisa, motivo } = evaluarPrecision(datos);
        const created = await base44.entities.RegistroGasto.create({
          operario_id: operario.id, operario_name: operario.name,
          operario_email: operario.user_email || user?.email || '',
          categoria: datos.categoria || 'otros',
          importe: Number(datos.importe) || 0,
          nombre_comercio: datos.nombre_comercio || '',
          nif_comercio: datos.nif_comercio || '',
          fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
          hora_documento: datos.hora_documento || '',
          numero_factura: datos.numero_factura || '',
          localidad: datos.localidad || '',
          forma_pago_documento: datos.forma_pago_documento || '',
          codigo_validacion_fiscal: datos.codigo_validacion_fiscal || '',
          concepto: datos.concepto || '',
          estado: estadoNacimiento,
          origen_pago: origenPago,
          ocr_status: 'procesado',
          precisa_precision: precisa,
          precision_motivo: precisa ? motivo : '',
          archivos: [{ url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString() }],
          numero_nota: `G-${Date.now().toString(36).toUpperCase()}`,
        });
        item.estado = precisa ? 'precision' : 'ok';
        item.detalle = precisa ? motivo : `${datos.nombre_comercio || '—'} · ${Number(datos.importe || 0).toFixed(2)} €`;
        item.id = created.id;
        lote.push({ idx: i, datos });
      } catch (e) {
        item.estado = 'error';
        item.detalle = e?.message || 'Error inesperado';
      }
      setResultados([...res]);
    }

    setProcesando(false);
    qc.invalidateQueries({ queryKey: ['conciliacion-gastos'] });
    qc.invalidateQueries({ queryKey: ['notas-gastos'] });
    const ok = res.filter(r => r.estado === 'ok').length;
    const precision = res.filter(r => r.estado === 'precision').length;
    const dup = res.filter(r => r.estado === 'duplicado').length;
    const err = res.filter(r => r.estado === 'error' || r.estado === 'error_ocr').length;
    toast.success(`${ok} limpios, ${precision} precisión, ${dup} duplicados, ${err} error`);
  };

  // Crear un duplicado confirmándolo (duplicado_confirmado: true)
  const crearIgualmente = async (idx) => {
    const item = resultados[idx];
    if (!item?.datos) return;
    const operario = operarios.find(o => o.id === operarioId);
    if (!operario) { toast.error('Operario no válido'); return; }
    try {
      const datos = item.datos;
      const { precisa, motivo } = evaluarPrecision(datos);
      const created = await base44.entities.RegistroGasto.create({
        operario_id: operario.id, operario_name: operario.name,
        operario_email: operario.user_email || user?.email || '',
        categoria: datos.categoria || 'otros',
        importe: Number(datos.importe) || 0,
        nombre_comercio: datos.nombre_comercio || '',
        nif_comercio: datos.nif_comercio || '',
        fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
        hora_documento: datos.hora_documento || '',
        numero_factura: datos.numero_factura || '',
        localidad: datos.localidad || '',
        forma_pago_documento: datos.forma_pago_documento || '',
        codigo_validacion_fiscal: datos.codigo_validacion_fiscal || '',
        concepto: datos.concepto || '',
        estado: estadoNacimiento,
        origen_pago: origenPago,
        ocr_status: 'procesado',
        precisa_precision: precisa,
        precision_motivo: precisa ? motivo : '',
        es_posible_duplicado: true,
        duplicado_confirmado: true,
        archivos: [{ url: item.file_url, nombre: item.nombre, tipo: '', fecha_subida: new Date().toISOString() }],
        numero_nota: `G-${Date.now().toString(36).toUpperCase()}`,
      });
      const next = [...resultados];
      next[idx] = { ...item, estado: 'ok', detalle: `Creado (dup. confirmado) — ${created.numero_nota}`, id: created.id };
      setResultados(next);
      qc.invalidateQueries({ queryKey: ['conciliacion-gastos'] });
      toast.success('Registro creado con duplicado confirmado');
    } catch (e) {
      toast.error(`No se pudo crear: ${e?.message || 'error'}`);
    }
  };

  const limpios = resultados.filter(r => r.estado === 'ok').length;
  const precision = resultados.filter(r => r.estado === 'precision').length;
  const dup = resultados.filter(r => r.estado === 'duplicado').length;
  const err = resultados.filter(r => r.estado === 'error' || r.estado === 'error_ocr').length;

  return (
    <div className="space-y-4">
      {/* Selector de destino */}
      <Card className="p-4 space-y-3">
        <Label className="text-xs">¿Qué tipo de documentos vas a subir?</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDestino('propios')}
            className={`text-left p-3 rounded-lg border-2 transition-colors ${destino === 'propios' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
          >
            <p className="text-sm font-semibold">Mis gastos a recuperar</p>
            <p className="text-xs text-muted-foreground mt-0.5">Medios propios — se te reembolsarán. Flujo borrador → aprobación.</p>
          </button>
          <button
            type="button"
            disabled={!verEmpresa}
            onClick={() => setDestino('empresa')}
            className={`text-left p-3 rounded-lg border-2 transition-colors disabled:opacity-40 ${destino === 'empresa' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
          >
            <p className="text-sm font-semibold">Facturas/tickets recibidos por la empresa</p>
            <p className="text-xs text-muted-foreground mt-0.5">{verEmpresa ? 'Medio empresa o crédito proveedor — solo registro contable, sin reembolso.' : 'Solo gerencia/administración/admin.'}</p>
          </button>
        </div>

        {destino === 'empresa' && verEmpresa && (
          <div className="space-y-1.5">
            <Label className="text-xs">Origen del pago</Label>
            <MobileSelect value={origenEmpresa} onValueChange={setOrigenEmpresa} placeholder="Origen" triggerClassName="w-full sm:w-64">
              <MobileSelectItem value="medio_empresa">Medio empresa (no reembolsable)</MobileSelectItem>
              <MobileSelectItem value="credito_proveedor">Crédito proveedor</MobileSelectItem>
            </MobileSelect>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Operario</Label>
          <MobileSelect value={operarioId} onValueChange={setOperarioId} placeholder="Seleccionar operario" triggerClassName="w-full sm:w-64">
            {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
          </MobileSelect>
          {!operarioId && (
            <p className="text-xs text-amber-600">Obligatorio: elige un operario para poder procesar los archivos.</p>
          )}
        </div>
      </Card>

      {/* Dropzone */}
      <Card className="p-6 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-center" onClick={() => inputRef.current?.click()} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onPick} />
        <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        {archivos.length === 0
          ? <p className="text-sm text-muted-foreground">Arrastra aquí varios justificantes o haz clic para seleccionarlos</p>
          : <p className="text-sm font-medium">{archivos.length} archivo(s) seleccionado(s) — clic para cambiar</p>}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Destino: <span className="font-medium">{destino === 'propios' ? 'Mis gastos (reembolso)' : `Recibidos empresa (${origenEmpresa === 'medio_empresa' ? 'medio empresa' : 'crédito proveedor'})`}</span>.
          {' '}Los duplicados no se crean automáticamente; puedes confirmarlos.
        </p>
        <Button onClick={procesar} disabled={procesando} className="gap-2">
          {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {procesando ? 'Procesando…' : `Procesar ${archivos.length || ''} archivo(s)`}
        </Button>
      </div>

      {resultados.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {limpios} limpios</span>
            <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {precision} precisión</span>
            {dup > 0 && <span className="text-orange-600 flex items-center gap-1"><Copy className="w-4 h-4" /> {dup} duplicados</span>}
            {err > 0 && <span className="text-red-600 flex items-center gap-1"><X className="w-4 h-4" /> {err} error</span>}
            {precision > 0 && <Link to="/notas-gastos?precision=1" className="text-primary hover:underline inline-flex items-center gap-1 ml-auto"><Link2 className="w-3 h-3" /> Revisar precisión</Link>}
          </div>
          <div className="space-y-1.5">
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md border border-border/60">
                {r.estado === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {r.estado === 'precision' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {r.estado === 'duplicado' && <Copy className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                {(r.estado === 'error' || r.estado === 'error_ocr') && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="font-medium truncate flex-1">{r.nombre}</span>
                <span className="text-muted-foreground truncate">{r.detalle}</span>
                {r.estado === 'duplicado' && (
                  <Button size="sm" variant="outline" onClick={() => crearIgualmente(i)} className="h-6 px-2 text-[10px]">Crear igualmente</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}