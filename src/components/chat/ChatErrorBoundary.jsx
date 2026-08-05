import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enviarReporteDiagnostico } from '@/lib/diagnosticoUtils';

/**
 * ErrorBoundary del Chat:
 *  - Captura cualquier excepción de render y muestra un fallback recuperable
 *    en vez de pantalla blanca.
 *  - Reporta automáticamente el crash (con stack trace) a DiagnosticoSesion
 *    para que IT pueda diagnosticar el origen real.
 */
export default class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Reportar el fallo con el stack de React para trazabilidad
    try {
      const userSnapshot =
        JSON.parse(localStorage.getItem('diag_user_snapshot') || 'null') ||
        { email: '', id: '', role: '' };
      enviarReporteDiagnostico({
        tipo: 'crash_js',
        severidad: 'critico',
        mensaje_error: `Chat crash: ${error?.message || 'Error desconocido'}`,
        stack_trace: [error?.stack, info?.componentStack?.split('\n').slice(0, 6).join('\n')]
          .filter(Boolean)
          .join('\n---\n'),
        ultima_accion: 'render Chat',
        user_email: userSnapshot.email || '',
        user_id: userSnapshot.id || '',
        user_role: userSnapshot.role || '',
      }).catch(() => {});
    } catch {
      /* sin-op: el reporte no debe bloquear la UI */
    }
  }

  handleReload = () => {
    // Recarga suave: resetea el boundary y reinicia React para la página
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isInvalidDate =
        (this.state.error?.message || '').includes('Invalid time value') ||
        (this.state.error?.message || '').toLowerCase().includes('date');

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <h2 className="text-lg font-semibold mb-1">El chat dejó de responder</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {isInvalidDate
              ? 'Se encontró un mensaje con una fecha inválida que impidió renderizar la conversación. Se ha reportado a IT.'
              : 'Se produjo un error al mostrar la conversación. Se ha reportado a IT.'}
          </p>
          <Button onClick={this.handleReload} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Recargar el chat
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}