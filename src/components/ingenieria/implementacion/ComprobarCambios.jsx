import React, { useEffect, useMemo, useState } from 'react';
import { BellDot, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ListaCambios from './ListaCambios';
import { leerUltimaRevision, guardarUltimaRevision, detectarCambios, fuentesSeguimiento } from '@/lib/cambiosSeguimiento';
import { fechaHoraES } from '@/lib/fechaES';

export default function ComprobarCambios({
  obraId, documentos, manuales, partes, materiales, fotos, fichajes, presupuestos, discrepancias, onIrA,
}) {
  const [revision, setRevision] = useState(() => leerUltimaRevision(obraId));
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setRevision(leerUltimaRevision(obraId));
    setAbierto(false);
  }, [obraId]);

  const fuentes = useMemo(
    () => fuentesSeguimiento({ documentos, manuales, partes, materiales, fotos, fichajes, presupuestos, discrepancias }),
    [documentos, manuales, partes, materiales, fotos, fichajes, presupuestos, discrepancias]
  );
  const cambios = useMemo(() => (revision ? detectarCambios(fuentes, revision) : []), [fuentes, revision]);
  const nuevas = cambios.filter((c) => c.nuevo).length;

  const marcarRevisado = () => {
    setRevision(guardarUltimaRevision(obraId));
    setAbierto(false);
  };

  const irAPestana = (pestana) => {
    setAbierto(false);
    if (onIrA) onIrA(pestana);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)} className="gap-2">
        <BellDot className="w-4 h-4" />
        Comprobar cambios
        {cambios.length > 0 && (
          <span className="ml-1 text-xs px-1.5 rounded-full bg-amber-500 text-white">{cambios.length}</span>
        )}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cambios en el seguimiento</DialogTitle>
            <DialogDescription>
              {revision
                ? 'Documentos y registros nuevos o modificados desde la última revisión.'
                : 'Aún no hay una revisión guardada para este proyecto.'}
            </DialogDescription>
          </DialogHeader>

          {!revision ? (
            <div className="space-y-3">
              <p className="text-sm">
                Se guardará este momento como punto de partida. A partir de ahora la app marcará los
                documentos, partes, materiales, fotos y horas que se suban o se modifiquen.
              </p>
              <Button onClick={marcarRevisado} className="gap-2 w-full">
                <Check className="w-4 h-4" />
                Guardar punto de partida
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                <span>
                  {cambios.length} novedad(es){nuevas > 0 ? ` · ${nuevas} nueva(s)` : ''}
                </span>
                <span>Última revisión: {fechaHoraES(revision)}</span>
              </div>

              <ListaCambios cambios={cambios} onIrA={irAPestana} />

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setAbierto(false)}>Cerrar</Button>
                <Button onClick={marcarRevisado} className="gap-2">
                  <Check className="w-4 h-4" />
                  Marcar como revisado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}