import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, UploadCloud, AlertTriangle, CheckCircle2, FileText, Link2 } from 'lucide-react';
import { extraerDatosGasto, evaluarPrecision } from '@/lib/ocrGastos';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Pestaña "Subida masiva de justificantes" — carga de N archivos a la vez.
 * Cada archivo: subida a CDN → OCR (InvokeLLM) → RegistroGasto en borrador.
 * Resumen: procesados limpios vs. marcados precisa_precision.
 */
export default function SubidaMasivaPanel() {
  const { user, isContabilidad, isAdmin, isGerencia, isAdministracion } = useUserRole();
  const qc = useQueryClient();
  const [operarioId, setOperarioId] = useState('');
  const [origenPago, setOrigenPago] = useState('medios_propios');
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const inputRef = useRef(null);

  // ¿Puede el usuario elegir origen_pago medio_empresa/credito_proveedor?
  const puedeEmpresa = isAdmin || isGerencia || isAdministracion || isContabilidad;

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-activos-subida'],
    queryFn: async () => {
      const list = await base44.entities.Operario.filter({ active: true }, 'name', 200);
      return list;
    },
  });

  // Pre-seleccionar el operario vinculado al usuario actual si es técnico/operario
  useEffect(() => {
    if (operarioId || !user?.email || !operarios.length) return;
    const vinculado = operarios.find(o => o.user_email === user.email);
    if (vinculado) setOperarioId(vinculado.id);
  }, [operarios, user?.email]);

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    setArchivos(files);
    setResultados([]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    setArchivos(files);
    setResultados([]);
  };

  const procesar = async () => {
    if (!operarioId) { toast.error('Selecciona un operario'); return; }
    if (!archivos.length) { toast.error('Añade al menos un archivo'); return; }
    const operario = operarios.find(o => o.id === operarioId);
    if (!operario) { toast.error('Operario no válido'); return; }

    setProcesando(true);
    setResultados([]);
    const res = [];
    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      const item = { nombre: file.name, estado: 'procesando', detalle: '' };
      res.push(item);
      setResultados([...res]);
      try {
        // 1. Subir a CDN
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        // 2. OCR
        const { datos, error } = await extraerDatosGasto(file_url);
        if (error || !datos) {
          item.estado = 'error_ocr';
          item.detalle = error || 'Sin datos';
          // Aun así creamos el registro en borrador con ia_no_disponible
          const created = await base44.entities.RegistroGasto.create({
            operario_id: operario.id,
            operario_name: operario.name,
            operario_email: operario.user_email || user?.email || '',
            categoria: 'otros',
            importe: 0,
            estado: 'borrador',
            origen_pago: origenPago,
            ocr_status: 'error',
            ia_no_disponible: true,
            archivos: [{ url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString() }],
            concepto: 'Subida masiva — OCR no disponible',
            fecha_documento: new Date().toISOString().slice(0, 10),
          });
          item.id = created.id;
          setResultados([...res]);
          continue;
        }
        // 3. Evaluar precisión
        const { precisa, motivo } = evaluarPrecision(datos);
        // 4. Crear RegistroGasto en borrador
        const created = await base44.entities.RegistroGasto.create({
          operario_id: operario.id,
          operario_name: operario.name,
          operario_email: operario.user_email || user?.email || '',
          categoria: datos.categoria || 'otros',
          importe: Number(datos.importe) || 0,
          nombre_comercio: datos.nombre_comercio || '',
          nif_comercio: datos.nif_comercio || '',
          fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
          numero_factura: datos.numero_factura || '',
          localidad: datos.localidad || '',
          forma_pago_documento: datos.forma_pago_documento || '',
          codigo_validacion_fiscal: datos.codigo_validacion_fiscal || '',
          concepto: datos.concepto || '',
          estado: 'borrador',
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
    const errores = res.filter(r => r.estado === 'error' || r.estado === 'error_ocr').length;
    toast.success(`${ok} limpios, ${precision} precisan revisión, ${errores} con error`);
  };

  const limpios = resultados.filter(r => r.estado === 'ok').length;
  const precision = resultados.filter(r => r.estado === 'precision').length;
  const errores = resultados.filter(r => r.estado === 'error' || r.estado === 'error_ocr').length;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Operario</Label>
            <MobileSelect value={operarioId} onValueChange={setOperarioId} placeholder="Seleccionar operario">
              {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origen del pago</Label>
            <MobileSelect value={origenPago} onValueChange={setOrigenPago} placeholder="Origen pago">
              <MobileSelectItem value="medios_propios">Medios propios (reembolsar)</MobileSelectItem>
              {puedeEmpresa && <MobileSelectItem value="medio_empresa">Medio empresa (no reembolsable)</MobileSelectItem>}
              {puedeEmpresa && <MobileSelectItem value="credito_proveedor">Crédito proveedor</MobileSelectItem>}
            </MobileSelect>
          </div>
        </div>

        {!puedeEmpresa && origenPago !== 'medios_propios' && (
          <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Solo gerencia/administración/admin pueden registrar pagos de empresa.</p>
        )}
      </Card>

      <Card
        className="p-6 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-center"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onPick} />
        <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        {archivos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Arrastra aquí varios justificantes o haz clic para seleccionarlos</p>
        ) : (
          <p className="text-sm font-medium">{archivos.length} archivo(s) seleccionado(s) — clic para cambiar</p>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cada archivo genera un RegistroGasto independiente en borrador, procesado por OCR+IA.</p>
        <Button onClick={procesar} disabled={procesando || !archivos.length || !operarioId} className="gap-2">
          {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {procesando ? 'Procesando…' : `Procesar ${archivos.length || ''} archivo(s)`}
        </Button>
      </div>

      {resultados.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {limpios} limpios</span>
            <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {precision} precisan revisión</span>
            {errores > 0 && <span className="text-red-600">{errores} con error</span>}
            {precision > 0 && (
              <Link to="/notas-gastos?precision=1" className="text-primary hover:underline inline-flex items-center gap-1 ml-auto">
                <Link2 className="w-3 h-3" /> Revisar precisión
              </Link>
            )}
          </div>
          <div className="space-y-1.5">
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md border border-border/60">
                {r.estado === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {r.estado === 'precision' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {(r.estado === 'error' || r.estado === 'error_ocr') && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="font-medium truncate flex-1">{r.nombre}</span>
                <span className="text-muted-foreground truncate">{r.detalle}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}