import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Download, FileCheck2, ExternalLink, AlertTriangle } from 'lucide-react';

function descargarBase64(base64, filename) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Confirmación y resultado de la exportación legal.
 * Genera el Excel oficial, lo archiva con su huella SHA-256 y deja constancia
 * en el registro de exportaciones antes de mostrar el resultado.
 */
export default function ExportacionLegalDialog({
  open, onOpenChange, desde, hasta, trabajadorId, trabajadorNombre, registros, trabajadores, onDone,
}) {
  const [estado, setEstado] = useState('confirmar');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const cerrar = (v) => {
    if (!v) {
      setEstado('confirmar');
      setResultado(null);
      setError('');
    }
    onOpenChange(v);
  };

  const generar = async () => {
    setEstado('generando');
    setError('');
    try {
      const res = await base44.functions.invoke('exportarRegistroLegal', {
        desde, hasta, trabajadorId: trabajadorId || undefined, archivar: true,
      });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      if (d.base64) descargarBase64(d.base64, d.filename);
      setResultado(d);
      setEstado('resultado');
      if (onDone) onDone();
    } catch (e) {
      setError(e.message);
      setEstado('error');
    }
  };

  const abrirCopia = async () => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: resultado.file_uri, expires_in: 600,
      });
      window.open(signed_url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {estado === 'resultado' ? 'Exportación legal archivada' : 'Generar y archivar exportación legal'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {estado === 'resultado'
              ? 'Guarda este código junto al archivo para acreditar que es la copia oficial.'
              : 'Se generará el Excel con los registros oficiales, se archivará una copia y quedará registrada su huella.'}
          </DialogDescription>
        </DialogHeader>

        {estado === 'resultado' && resultado ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <p className="text-sm font-semibold break-all">{resultado.filename}</p>
              <p className="text-xs text-muted-foreground">
                {resultado.registros} registros · {trabajadores || 0} trabajadores · periodo {desde} a {hasta}
              </p>
              {resultado.archivado ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                  <FileCheck2 className="w-3 h-3" /> Copia archivada
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" /> Descargada sin archivar
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Huella SHA-256</p>
              <p className="font-mono text-[11px] break-all rounded-md bg-muted px-2 py-1.5">{resultado.hash_sha256}</p>
            </div>

            {!resultado.archivado && resultado.custodia_error && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No se pudo archivar la copia: {resultado.custodia_error}. El archivo descargado es válido.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => descargarBase64(resultado.base64, resultado.filename)}>
                <Download className="w-3.5 h-3.5" /> Descargar de nuevo
              </Button>
              {resultado.archivado && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={abrirCopia}>
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir copia archivada
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground">
                  {desde} a {hasta}{trabajadorNombre ? ` · ${trabajadorNombre}` : ' · Todos los trabajadores'}
                </p>
                <p>{registros} registros oficiales · {trabajadores} trabajadores</p>
                <p>Solo se incluyen registros validados. El archivo se archiva en almacenamiento privado con su huella SHA-256 y queda registrado quién lo generó.</p>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {estado === 'resultado' ? (
            <Button onClick={() => cerrar(false)}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => cerrar(false)} disabled={estado === 'generando'}>Cancelar</Button>
              <Button onClick={generar} disabled={estado === 'generando' || registros === 0} className="gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {estado === 'generando' ? 'Generando…' : 'Generar y archivar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}