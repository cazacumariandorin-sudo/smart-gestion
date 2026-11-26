import React from 'react';
import {
  FileText, BookOpen, ClipboardList, PackageSearch, Camera, Clock, Receipt, AlertTriangle,
} from 'lucide-react';
import { fechaHoraES } from '@/lib/fechaES';

const ICONOS = {
  documento: FileText,
  manual: BookOpen,
  parte: ClipboardList,
  material: PackageSearch,
  fotos: Camera,
  fichajes: Clock,
  presupuesto: Receipt,
  discrepancia: AlertTriangle,
};

const MAX_VISIBLES = 40;

export default function ListaCambios({ cambios, onIrA }) {
  if (cambios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Sin novedades desde la última revisión.
      </p>
    );
  }

  const visibles = cambios.slice(0, MAX_VISIBLES);

  return (
    <div className="max-h-[52vh] overflow-y-auto divide-y divide-border border border-border rounded-lg">
      {visibles.map((c) => {
        const Icono = ICONOS[c.tipo] || FileText;
        return (
          <button
            key={c.clave}
            type="button"
            onClick={() => c.pestana && onIrA(c.pestana)}
            className="w-full text-left p-2.5 flex items-start gap-2.5 hover:bg-muted/50 transition-colors"
          >
            <Icono className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium break-words">{c.titulo}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>{c.etiqueta}</span>
                {c.detalle && <span>· {c.detalle}</span>}
                {c.fecha && <span>· {fechaHoraES(c.fecha)}</span>}
              </div>
            </div>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded border shrink-0 ${
                c.nuevo
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
              }`}
            >
              {c.nuevo ? 'Nuevo' : 'Actualizado'}
            </span>
          </button>
        );
      })}
      {cambios.length > MAX_VISIBLES && (
        <p className="p-2.5 text-xs text-muted-foreground">
          y {cambios.length - MAX_VISIBLES} novedad(es) más
        </p>
      )}
    </div>
  );
}