import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ExternalLink, Package, FileSpreadsheet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Botón "Descargar fotos del ciclo" — rescate de fotos de justificantes.
 * Permisos: cualquier rol puede invocar; el backend restringe a operario solo
 * sus propias fotos (resuelve por user.email) si no es rol privilegiado.
 *
 * Props:
 *   cicloMes: "2026-08"  (obligatorio)
 *   operarioId?: "..."   (opcional; backend lo ignora si no es rol privilegiado)
 *   size?: 'sm' | 'default'
 *   variant?: 'outline' | 'secondary' | 'default'
 *   label?: texto del botón
 *   onDone?: callback tras descarga exitosa
 */
export default function DescargarFotosCicloButton({
  cicloMes,
  operarioId,
  size = 'sm',
  variant = 'outline',
  label = 'Descargar fotos',
  className = '',
  onDone,
}) {
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const handleDescargar = async () => {
    if (!cicloMes) { toast.error('Falta el ciclo'); return; }
    setGenerando(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('descargarFotosCicloOperario', {
        ciclo_mes: cicloMes,
        operario_id: operarioId || undefined,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error desconocido');
      setResultado(data);
      if (data?.total_archivos > 0) {
        toast.success(`${data.total_archivos} foto(s) del ciclo ${cicloMes} listas`);
        if (typeof onDone === 'function') onDone(data);
      } else {
        toast.info(data?.mensaje || 'No había fotos para descargar');
      }
    } catch (e) {
      toast.error(`Error: ${e?.message || 'No se pudo generar la descarga'}`);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={handleDescargar}
        disabled={generando || !cicloMes}
        variant={variant}
        size={size}
        className={`gap-1.5 ${className}`}
        title={`Descargar ZIP con las fotos de justificantes del ciclo ${cicloMes}`}
      >
        {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {generando ? 'Generando…' : label}
      </Button>

      {resultado?.zip_url && (
        <a
          href={resultado.zip_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <Package className="w-3.5 h-3.5 text-primary" />
          ZIP ({resultado.total_archivos} fotos)
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      )}
      {resultado?.indice_excel_url && (
        <a
          href={resultado.indice_excel_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          Excel índice
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      )}
    </div>
  );
}