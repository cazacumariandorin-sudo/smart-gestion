import React from 'react';
import { BadgeCheck, Image as ImageIcon } from 'lucide-react';
import SinDatos from './SinDatos';
import { fechaCorta } from '@/lib/fechaCorta';

export default function ImplementacionFotos({ fotos }) {
  if (!fotos.length) {
    return (
      <SinDatos
        mensaje="Sin fotos vinculadas"
        detalle="No hay fotos de esta obra en el archivo. La verificación visual solo puede mostrarse cuando existen fotos cargadas."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {fotos.length} foto(s) · {fotos.filter((f) => f.validada).length} validada(s). La validación es humana: una foto
        no se toma como avance confirmado hasta que alguien la valida.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {fotos.map((f) => (
          <a
            key={f.id}
            href={f.foto_url}
            target="_blank"
            rel="noreferrer"
            className="group bg-card border border-border rounded-xl overflow-hidden hover:border-teal-300 transition-colors"
          >
            <div className="aspect-[4/3] bg-muted overflow-hidden">
              {f.miniatura_url || f.foto_url ? (
                <img
                  src={f.miniatura_url || f.foto_url}
                  alt={f.titulo || f.descripcion || 'Foto de obra'}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-muted-foreground">{fechaCorta(f.fecha_foto)}</span>
                {f.validada ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="w-3 h-3" /> Validada
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">Sin validar</span>
                )}
              </div>
              {(f.titulo || f.descripcion) && (
                <p className="text-xs mt-0.5 line-clamp-2">{f.titulo || f.descripcion}</p>
              )}
              {f.operario_name && <p className="text-[11px] text-muted-foreground mt-0.5">{f.operario_name}</p>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}