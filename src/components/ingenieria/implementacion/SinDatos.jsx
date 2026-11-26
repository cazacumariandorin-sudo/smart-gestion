import React from 'react';
import { Inbox } from 'lucide-react';

export default function SinDatos({ mensaje = 'Sin datos cargados', detalle }) {
  return (
    <div className="p-6 text-center text-muted-foreground">
      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm font-medium">{mensaje}</p>
      {detalle && <p className="text-xs mt-1 max-w-md mx-auto leading-relaxed">{detalle}</p>}
    </div>
  );
}