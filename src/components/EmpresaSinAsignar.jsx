import React from 'react';
import { Building2, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Pantalla de bloqueo para un acceso que aún no está asignado a ninguna
 * empresa: sin empresa no se muestra ningún dato.
 */
export default function EmpresaSinAsignar() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full border rounded-xl p-6 bg-card text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="font-semibold text-lg">Tu acceso no está asignado a ninguna empresa</h2>
        <p className="text-sm text-muted-foreground">
          Cada acceso pertenece a una sola empresa. Pide a tu administrador que te asigne la tuya;
          hasta entonces no se muestra ningún dato.
        </p>
        <button
          type="button"
          onClick={() => base44.auth.logout()}
          className="text-sm text-primary underline underline-offset-4 min-h-[44px]"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}