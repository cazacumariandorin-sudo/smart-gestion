import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Padre lógico de una ruta: /a/b/c → /a/b · /a → / · / → null (permite salir).
 * Es el destino del botón "atrás" cuando no hay capa abierta.
 */
export function padreLogico(pathname) {
  const partes = (pathname || '/').split('/').filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return '/';
  return '/' + partes.slice(0, -1).join('/');
}

/** ¿Hay un diálogo, alerta u hoja abierta? */
export function hayCapaAbierta() {
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-vaul-drawer][data-state="open"]'
  );
}

/** Cierra la capa abierta (diálogo, alerta, hoja inferior) con Escape. */
function cerrarCapaAbierta() {
  if (!hayCapaAbierta()) return false;
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })
  );
  return true;
}

/**
 * Botón físico "atrás" de Android:
 *   1. si hay un modal/hoja abierto, lo cierra (no navega),
 *   2. si no, navega al padre lógico de la pantalla,
 *   3. solo en la raíz deja salir de la app.
 *
 * En escritorio no se instala nada: la navegación del navegador queda intacta.
 */
export function useAndroidBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const rutaRef = useRef(location.pathname);
  rutaRef.current = location.pathname;

  useEffect(() => {
    const atras = () => {
      if (cerrarCapaAbierta()) return true;
      const padre = padreLogico(rutaRef.current);
      if (padre) {
        navigate(padre);
        return true;
      }
      return false;
    };

    // WebView nativo con Capacitor
    const capApp = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.App : null;
    if (capApp?.addListener) {
      const sub = capApp.addListener('backButton', ({ canGoBack } = {}) => {
        if (!atras() && canGoBack) capApp.exitApp?.();
      });
      return () => { Promise.resolve(sub).then((h) => h?.remove?.()).catch(() => {}); };
    }

    // WebView sin Capacitor / navegador móvil: centinela en el historial.
    // Solo en táctil, para no alterar el atrás de escritorio.
    const esTactil = window.matchMedia?.('(pointer: coarse)').matches;
    if (!esTactil) return;

    window.history.pushState({ sgGuard: true }, '', window.location.href);
    const onPop = () => {
      if (atras()) {
        // La pulsación se ha consumido: se vuelve a armar el centinela
        window.history.pushState({ sgGuard: true }, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate]);
}

export default useAndroidBack;