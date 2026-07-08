import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useBackButton — navegación "atrás" unificada: botón, tecla ESC y botón físico
 * "atrás" de Android (evento popstate del navegador).
 * Uso: const { handleBack, canGoBack } = useBackButton({ backTo, onBack, enabled });
 */
export function useBackButton({ backTo, onBack, enabled = true } = {}) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    navigate(-1);
  }, [onBack, backTo, navigate]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handleBack]);

  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;

  return { handleBack, canGoBack };
}