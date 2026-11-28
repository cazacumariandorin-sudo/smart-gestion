import React from 'react';
import { useNavigate } from 'react-router-dom';
import PanelAccesoPendiente from '@/components/acceso/PanelAccesoPendiente';

/** Página pública del flujo de alta: confirmar invitación o solicitar empresa. */
export default function AltaEmpresa() {
  const navigate = useNavigate();
  return <PanelAccesoPendiente onAccesoConfirmado={() => navigate('/', { replace: true })} />;
}