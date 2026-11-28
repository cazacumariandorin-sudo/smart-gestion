import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Eraser, Loader2, Search } from 'lucide-react';

/**
 * Limpieza de rastros de empresas ya borradas. Solo se ocupa de empresas que
 * ya no existen: las inactivas siguen en la base de datos y no se tocan.
 */
export default function LimpiezaEmpresasPanel() {
  const [analizando, setAnalizando] = useState(false);
  const [huerfanos, setHuerfanos] = useState(null);
  const [limpiando, setLimpiando] = useState(null);

  const analizar = async () => {
    setAnalizando(true);
    try {
      const res = await base44.functions.invoke('limpiarEmpresa', { modo: 'analizar' });
      setHuerfanos(res.data?.huerfanos || []);
      if (!res.data?.huerfanos?.length) {
        toast({ title: 'Sin rastros pendientes', description: 'No hay datos de empresas borradas.' });
      }
    } catch (e) {
      toast({ title: 'Error al buscar rastros', description: e?.message, variant: 'destructive' });
    } finally {
      setAnalizando(false);
    }
  };

  const limpiar = async (empresaId) => {
    setLimpiando(empresaId);
    try {
      await base44.functions.invoke('limpiarEmpresa', { modo: 'purgar', empresa_id: empresaId });
      setHuerfanos((prev) => (prev || []).filter((h) => h.empresa_id !== empresaId));
      toast({ title: 'Rastros eliminados' });
    } catch (e) {
      toast({ title: 'Error al limpiar', description: e?.message, variant: 'destructive' });
    } finally {
      setLimpiando(null);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2"><Eraser className="h-4 w-4 text-primary" /> Limpieza de empresas borradas</p>
          <p className="text-xs text-muted-foreground">Busca restos en la base de datos de empresas que ya no existen (privilegios, espacio, plan, invitaciones y datos asociados). Las empresas inactivas no se tocan.</p>
        </div>
        <Button variant="outline" size="sm" onClick={analizar} disabled={analizando}>
          {analizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar rastros
        </Button>
      </div>

      {huerfanos !== null && (huerfanos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin rastros pendientes.</p>
      ) : (
        <div className="space-y-2">
          {huerfanos.map((h) => (
            <div key={h.empresa_id} className="flex items-center justify-between gap-3 border rounded-md p-2 text-xs">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-muted-foreground truncate">{h.empresa_id}</p>
                <p className="text-foreground">{h.total_registros} registro(s) · {Object.entries(h.detalle || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" disabled={limpiando === h.empresa_id} onClick={() => limpiar(h.empresa_id)}>
                {limpiando === h.empresa_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />} Borrar rastros
              </Button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}