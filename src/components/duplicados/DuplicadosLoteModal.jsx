import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { checkDuplicados } from '@/hooks/useDuplicadoCheck.js';
import { AlertTriangle } from 'lucide-react';

export default function DuplicadosLoteModal({ open, onClose, registros = [], tipoLabel = 'registro' }) {
  const grupos = useMemo(() => {
    const vistos = new Set();
    const result = [];
    for (const reg of registros) {
      if (vistos.has(reg.id)) continue;
      const dups = checkDuplicados(registros, reg.name, reg.id);
      if (dups.length > 0) {
        result.push({ original: reg, similares: dups });
        vistos.add(reg.id);
        dups.forEach(d => vistos.add(d.id));
      }
    }
    return result;
  }, [registros]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Posibles duplicados — {tipoLabel}s
          </DialogTitle>
        </DialogHeader>
        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No se detectaron duplicados.</p>
        ) : (
          <div className="space-y-4 mt-2">
            {grupos.map((g, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Grupo {i + 1}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs bg-white dark:bg-card">{g.original.name}</Badge>
                  {g.similares.map(s => (
                    <Badge key={s.id} variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 border-amber-300">
                      {s.name} <span className="ml-1 text-amber-600">({Math.round(s.similitud * 100)}%)</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}