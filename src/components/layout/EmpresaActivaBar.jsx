import React from 'react';
import { Building2 } from 'lucide-react';
import { useEmpresaActiva } from '@/lib/EmpresaActivaContext';

/**
 * Franja con la empresa del acceso. Solo el propietario ve selector: quien
 * pertenece a una única empresa entra directamente en la suya.
 */
export default function EmpresaActivaBar() {
  const { empresa, empresas, puedeCambiar, cambiarEmpresa } = useEmpresaActiva();
  if (!empresa) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/40 text-xs">
      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      <span className="font-medium truncate">{empresa.nombre}</span>
      <span className="text-muted-foreground hidden sm:inline">· datos aislados</span>
      {puedeCambiar && (
        <select
          value={empresa.id}
          onChange={(e) => cambiarEmpresa(e.target.value)}
          aria-label="Empresa supervisada"
          className="ml-auto h-7 rounded border bg-background px-1 text-xs"
        >
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      )}
    </div>
  );
}