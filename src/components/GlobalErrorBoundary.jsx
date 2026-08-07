import React from 'react';

const RELOAD_FLAG_KEY = 'sg_global_eb_reload_once';

function esErrorDeCarga(error) {
  const msg = String(error?.message || error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(error?.name || '') ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

/**
 * ErrorBoundary global de la aplicación.
 *
 * Envuelve todas las rutas (App.jsx). Sin esto, un fallo al cargar el chunk
 * JS de una página con lazy() (típico justo después de publicar una nueva
 * versión, con caché del navegador desactualizada o con cobertura débil)
 * no tiene nada que lo capture: React desmonta el árbol y la app se queda
 * en blanco, a veces con restos del DOM anterior aún interactivos.
 *
 * - Error de carga de módulo -> recarga la página una sola vez, en
 *   silencio (sessionStorage evita bucles de recarga infinitos si el
 *   fallo persiste, p. ej. sin conexión).
 * - Cualquier otro error -> pantalla amigable con botón "Recargar",
 *   nunca una pantalla en blanco sin explicación.
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[GlobalErrorBoundary] Error no capturado:', error, info);

    if (esErrorDeCarga(error)) {
      let yaRecargo = false;
      try { yaRecargo = sessionStorage.getItem(RELOAD_FLAG_KEY) === '1'; } catch { /* sin-op */ }

      if (!yaRecargo) {
        try { sessionStorage.setItem(RELOAD_FLAG_KEY, '1'); } catch { /* sin-op */ }
        window.location.reload();
        return;
      }
    }
  }

  handleReload = () => {
    try { sessionStorage.removeItem(RELOAD_FLAG_KEY); } catch { /* sin-op */ }
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (error) {
      // Si es un error de carga de módulo y aún no hemos intentado recargar,
      // no mostrar nada (la recarga ya está en marcha desde componentDidCatch).
      let yaRecargo = false;
      try { yaRecargo = sessionStorage.getItem(RELOAD_FLAG_KEY) === '1'; } catch { /* sin-op */ }
      if (esErrorDeCarga(error) && yaRecargo) {
        return null;
      }

      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-6 h-6 text-destructive">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-base">Ha ocurrido un error</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Algo ha fallado al cargar esta pantalla. Puedes intentar recargar la página.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
