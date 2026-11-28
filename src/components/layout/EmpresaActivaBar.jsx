import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, LayoutDashboard } from 'lucide-react';
import { useEmpresaActiva } from '@/lib/EmpresaActivaContext';

/**
 * Franja con la empresa abierta. Un acceso normal queda fijado a la suya.
 * El propietario global ve aquí su consola y puede abrir cualquier empresa.
 */
export default function EmpresaActivaBar() {
  const {
    empresa, empresas, esPropietario, puedeCambiar,
    cambiarEmpresa, entrarEmpresa, irAConsola,
  } = useEmpresaActiva();

  if (!empresa && !esPropietario) return null;

  if (!empresa) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-primary/5 text-xs">
        <LayoutDashboard className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="font-medium">Consola del propietario</span>
        <span className="text-muted-foreground hidden sm:inline">· sin empresa abierta</span>
        {empresas.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) entrarEmpresa(e.target.value); }}
            aria-label="Abrir empresa"
            className="ml-auto h-7 max-w-[200px] rounded border bg-background px-1 text-xs"
          >
            <option value="">Abrir empresa…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/40 text-xs">
      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      <span className="font-medium truncate">
        {esPropietario ? `Propietario · ${empresa.nombre}` : empresa.nombre}
      </span>
      {!esPropietario && <span className="text-muted-foreground hidden sm:inline">· datos aislados</span>}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {puedeCambiar && (
          <select
            value={empresa.id}
            onChange={(e) => cambiarEmpresa(e.target.value)}
            aria-label="Empresa abierta"
            className="h-7 max-w-[170px] rounded border bg-background px-1 text-xs"
          >
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        )}
        {esPropietario && (
          <Link
            to="/consola"
            onClick={irAConsola}
            className="inline-flex items-center gap-1 rounded border bg-background px-2 h-7 hover:bg-accent"
          >
            <LayoutDashboard className="h-3 w-3" aria-hidden="true" /> Consola
          </Link>
        )}
      </div>
    </div>
  );
}