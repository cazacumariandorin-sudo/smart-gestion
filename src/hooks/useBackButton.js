import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { padreLogico, hayCapaAbierta } from '@/hooks/useAndroidBack';

/**
 * useBackButton — navegación "atrás" unificada: botón, tecla ESC y botón físico
 * "atrás" de Android (evento popstate del navegador).
 * Uso: const { handleBack, canGoBack } = useBackButton({ backTo, onBack, enabled });
 */
export function useBackButton({ backTo, onBack, enabled = true } = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    // Padre lógico primero: evita quedarse atrapado en entradas duplicadas
    // del historial y funciona también si se entra por enlace directo.
    const padre = padreLogico(location.pathname);
    if (padre) return navigate(padre);
    navigate(-1);
  }, [onBack, backTo, navigate, location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e) => {
      // Si hay un diálogo o hoja abierta, Escape lo cierra (no navega)
      if (e.key === 'Escape' && !hayCapaAbierta()) handleBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handleBack]);

  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;

  return { handleBack, canGoBack };
}