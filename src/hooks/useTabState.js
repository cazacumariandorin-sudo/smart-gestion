import { useState, useEffect } from 'react';

/**
 * Hook para persisten tab state por página
 * Almacena el tab activo en sessionStorage por ruta
 * @param {string} pageKey - Identificador único de la página (ej: "gastos-operarios")
 * @param {string} defaultTab - Tab por defecto
 */
export function useTabState(pageKey, defaultTab = '') {
  const storageKey = `tab_state_${pageKey}`;

  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return defaultTab;
    return sessionStorage.getItem(storageKey) || defaultTab;
  });

  useEffect(() => {
    sessionStorage.setItem(storageKey, tab);
  }, [tab, storageKey]);

  return [tab, setTab];
}