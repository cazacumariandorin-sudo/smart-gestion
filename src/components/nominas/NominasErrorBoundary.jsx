import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary local para la página de Nóminas.
 * Captura errores de render (p. ej. mutaciones de estado durante el render,
 * campos inesperados en datos de técnicos) y muestra un mensaje recuperable
 * en lugar de una pantalla en blanco.
 */
export default class NominasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[NominasErrorBoundary] Error de render:', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 px-4">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">No se pudo cargar la página de nóminas</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Se produjo un error inesperado al renderizar la pantalla. Puedes intentar recargar o contactar con administración.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}