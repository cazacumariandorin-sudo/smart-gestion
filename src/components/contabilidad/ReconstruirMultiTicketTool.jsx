import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Split, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/lib/useUserRole';

/**
 * Herramienta de Precisión "Re-OCR multi-ticket" — reconstruye un registro mal
 * creado (varios justificantes colapsados en un solo importe) re-procesando cada
 * foto con el flujo multi-ticket y creando un registro real por ticket.
 *
 * Acceso: gerencia, administración, admin. Se invoca desde el panel de Precisión
 * (Contabilidad) o desde el botón de precisión en Gestión Gastos.
 */
export default function ReconstruirMultiTicketTool({ registroIdInicial }) {
  const { isGerencia, isAdministracion, isAdmin } = useUserRole();
  const puede = isGerencia || isAdministracion || isAdmin;
  const qc = useQueryClient();
  const [registroId, setRegistroId] = useState(registroIdInicial || '');
  const [precision, setPrecision] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const ejecutar = async () => {
    if (!registroId.trim()) { toast.error('Introduce el ID del registro a reconstruir'); return; }
    setEjecutando(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('reconstruirRegistroMultiTicket', {
        registro_id: registroId.trim(),
        precision,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error');
      setResultado(data);
      toast.success(`${data.total_creados} registro(s) creados desde ${data.total_archivos_procesados} foto(s)`);
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      qc.invalidateQueries({ queryKey: ['conciliacion-gastos'] });
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
    } catch (e) {
      toast.error(`Error: ${e?.message || 'fallo'}`);
    } finally {
      setEjecutando(false);
    }
  };

  if (!puede) {
    return <Card className="p-6 text-center text-muted-foreground text-sm">Solo gerencia, administración o admin pueden reconstruir registros.</Card>;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Split className="w-4 h-4 text-primary" />
        <span className="font-medium">Re-OCR multi-ticket — reconstruir registro</span>
        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Herramienta de precisión</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Cuando un técnico subió varios justificantes como "páginas" de un único gasto y el sistema los colapsó en un solo importe, esta herramienta re-procesa CADA foto con el flujo multi-ticket y crea un registro real por ticket detectado (con su foto, su importe y su fecha reales). El registro original se anula (no se borra) como auditoría.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-64">
          <Label className="text-xs">ID del registro a reconstruir</Label>
          <Input
            value={registroId}
            onChange={e => setRegistroId(e.target.value)}
            placeholder="6aa86d30df9d04f0c300d44b"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
          <input
            type="checkbox"
            id="precision-chk"
            checked={precision}
            onChange={e => setPrecision(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="precision-chk" className="text-xs cursor-pointer flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Alta precisión (gemini, +créditos)
          </Label>
        </div>
        <Button onClick={ejecutar} disabled={ejecutando} className="gap-2">
          {ejecutando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
          {ejecutando ? 'Reconstruyendo…' : 'Reconstruir'}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Coste aprox: ~1 crédito de integración por foto (automático) o ~5 créditos/foto (alta precisión). El registro original pasa a estado "rechazada" y conserva sus fotos como auditoría.
      </p>

      {resultado && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {resultado.total_creados > 0 ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">{resultado.total_creados} registro(s) creado(s)</span></>
            ) : (
              <><AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="font-medium">No se creó ningún registro</span></>
            )}
            {resultado.total_omitidos > 0 && (
              <span className="text-xs text-amber-600">· {resultado.total_omitidos} foto(s) omitida(s)</span>
            )}
            <span className="text-xs text-muted-foreground">· {resultado.total_archivos_procesados} foto(s) procesada(s)</span>
          </div>
          {resultado.registros_creados?.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {resultado.registros_creados.map((r, i) => (
                <div key={r.id || i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-card">
                  <div className="min-w-0">
                    <span className="font-medium truncate">{r.nombre_comercio || '—'}</span>
                    <span className="text-muted-foreground ml-1">· {r.fecha_documento}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.precisa_precision && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    <span className="font-bold">{Number(r.importe || 0).toFixed(2)} €</span>
                    <Badge className="text-[9px] bg-slate-100 text-slate-600">{r.ciclo_mes}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {resultado.errores?.length > 0 && (
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer">{resultado.errores.length} error(es)</summary>
              <ul className="pl-4 list-disc">{resultado.errores.map((e, i) => <li key={i}>{e.foto}: {e.error}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}