import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, XCircle, Eye, RotateCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { reprocesarPrecisionGasto, construirDiff } from '@/lib/ocrGastos';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Lote máximo por tanda de re-procesamiento (respeta el cupo de créditos).
const LOTE_MAX = 25;

export default function PrecisionPanel({ notas, onVerNota }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState({ total: 0, actual: 0, corregidos: 0, sinCambios: 0, errores: 0, diffs: [] });

  // Solo admin/gerencia ven el panel completo.
  if (!isAdmin && !isGerencia && !isAdministracion) return null;

  // Filtrar notas marcadas como precisa_precision con archivo adjunto.
  const pendientes = notas.filter(n => n.precisa_precision && n.archivos?.length > 0);

  const reprocesar = async () => {
    if (!pendientes.length) {
      toast.info('No hay registros pendientes de precisión');
      return;
    }
    const lote = pendientes.slice(0, LOTE_MAX);
    if (!window.confirm(`Se re-procesarán ${lote.length} registros con gemini_3_flash (~${lote.length * 5} créditos). ¿Continuar?`)) return;

    setProcesando(true);
    const res = { total: lote.length, actual: 0, corregidos: 0, sinCambios: 0, errores: 0, diffs: [] };
    setProgreso({ ...res });

    for (const nota of lote) {
      res.actual += 1;
      const file_url = nota.archivos[0]?.url;
      if (!file_url) { res.errores += 1; setProgreso({ ...res }); continue; }
      try {
        const { datos, error } = await reprocesarPrecisionGasto(file_url);
        if (error || !datos) { res.errores += 1; setProgreso({ ...res }); continue; }

        // Construir diff con los datos guardados.
        const diff = construirDiff(nota, datos);
        const update = {
          precisa_precision: false,
          precision_revisado_por: user?.email || 'admin',
          precision_fecha: new Date().toISOString(),
          precision_modelo_usado: 'gemini_3_flash',
          precision_diff: diff || 'Sin cambios detectados',
          ocr_status: 'procesado',
        };

        // Rellenar campos que estaban vacíos con lo extraído (sin sobrescribir lo ya confirmado por el usuario).
        if (datos.importe != null && !nota.importe) update.importe = Number(datos.importe);
        if (datos.fecha_documento && !nota.fecha_documento) update.fecha_documento = datos.fecha_documento;
        if (datos.nombre_comercio && !nota.nombre_comercio) update.nombre_comercio = datos.nombre_comercio;
        if (datos.nif_comercio && !nota.nif_comercio) update.nif_comercio = datos.nif_comercio;
        if (datos.numero_factura && !nota.numero_factura) update.numero_factura = datos.numero_factura;
        if (datos.codigo_validacion_fiscal && !nota.codigo_validacion_fiscal) update.codigo_validacion_fiscal = datos.codigo_validacion_fiscal;
        if (datos.categoria && !nota.categoria) update.categoria = datos.categoria;
        if (datos.concepto && !nota.concepto) update.concepto = datos.concepto;

        await base44.entities.RegistroGasto.update(nota.id, update);
        if (diff) { res.corregidos += 1; res.diffs.push({ id: nota.id, numero: nota.numero_nota, diff }); }
        else { res.sinCambios += 1; }
      } catch (e) {
        res.errores += 1;
        console.warn('Error re-procesando', nota.id, e);
      }
      setProgreso({ ...res });
    }

    setProcesando(false);
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
    toast.success(`Revisión completada: ${res.corregidos} corregidos · ${res.sinCambios} sin cambios · ${res.errores} errores`, { duration: 6000 });
  };

  return (
    <Card className="mb-4 border-amber-200 dark:border-amber-900">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Revisión de precisión OCR</h3>
              <p className="text-xs text-muted-foreground">
                {pendientes.length} registro{pendientes.length !== 1 ? 's' : ''} marcado{pendientes.length !== 1 ? 's' : ''} para re-procesamiento con modelo superior
              </p>
            </div>
          </div>
          <Button
            onClick={reprocesar}
            disabled={procesando || !pendientes.length}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            size="sm"
          >
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            {procesando ? `Procesando ${progreso.actual}/${progreso.total}` : `Reprocesar pendientes${pendientes.length ? ` (${Math.min(pendientes.length, LOTE_MAX)})` : ''}`}
          </Button>
        </div>
      </CardHeader>

      {procesando && (
        <div className="px-6 pb-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progreso.total ? (progreso.actual / progreso.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {progreso.corregidos} corregidos</span>
            <span className="text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {progreso.sinCambios} sin cambios</span>
            <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> {progreso.errores} errores</span>
          </div>
        </div>
      )}

      {progreso.diffs.length > 0 && (
        <CardContent className="pt-0 max-h-64 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Últimos cambios aplicados:</p>
          <div className="space-y-1.5">
            {progreso.diffs.slice(-8).map(d => (
              <div key={d.id} className="text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <span className="font-mono font-bold text-primary">{d.numero}</span>
                <p className="text-muted-foreground mt-0.5 break-words">{d.diff}</p>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {!procesando && pendientes.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {pendientes.map(n => (
              <div key={n.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-xs font-bold text-primary">{n.numero_nota || '—'}</span>
                    <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Precisa precisión
                    </Badge>
                    {n.operario_name && <span className="text-[10px] text-muted-foreground">{n.operario_name}</span>}
                  </div>
                  <p className="text-xs truncate">{n.nombre_comercio || n.concepto || 'Sin descripción'}</p>
                  {n.precision_motivo && <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">⚠ {n.precision_motivo}</p>}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onVerNota?.(n)} title="Ver detalle">
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {!procesando && pendientes.length === 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-muted-foreground">No hay registros pendientes de revisión de precisión.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}