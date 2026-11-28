import React from 'react';
import PanelAccesoPendiente from '@/components/acceso/PanelAccesoPendiente';

/**
 * Bloqueo de acceso para quien todavía no tiene empresa: no se muestra ningún
 * dato, solo el estado de su invitación o la solicitud de alta.
 */
export default function EmpresaSinAsignar() {
  return <PanelAccesoPendiente />;
}