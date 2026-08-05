import { enviarReporteDiagnostico } from '@/lib/diagnosticoUtils';

// Cache del usuario actual (persistido por AuthContext)
let currentUserSnapshot = { email: '', id: '', role: '' };

export function setCurrentUserForDiag(user) {
  if (user) {
    currentUserSnapshot = {
      email: user.email || '',
      id: user.id || '',
      role: user.role || ''
    };
    // Persistir para que los ErrorBoundary (clases que no usan contexto) lean el usuario
    try {
      localStorage.setItem('diag_user_snapshot', JSON.stringify(currentUserSnapshot));
    } catch { /* sessionStorage/privado */ }
  }
}

function extraerStack(err) {
  try {
    return err?.stack || '';
  } catch { return ''; }
}

export function setupGlobalErrorHandling() {
  // Errores de JS no capturados (pantallas blancas)
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    const err = event.error || {};
    const esTimeout = (err.message || '').includes('timeout') || (err.message || '').toLowerCase().includes('network');

    // Reportar a la base de datos (captura automática)
    enviarReporteDiagnostico({
      tipo: esTimeout ? 'timeout_red' : 'crash_js',
      severidad: 'critico',
      mensaje_error: (err.message || 'Error desconocido') + (event.filename ? ` @ ${event.filename}:${event.lineno}:${event.colno}` : ''),
      stack_trace: extraerStack(err),
      user_email: currentUserSnapshot.email,
      user_id: currentUserSnapshot.id,
      user_role: currentUserSnapshot.role
    }).catch(() => {});

    if (esTimeout) {
      window.dispatchEvent(
        new CustomEvent('pageError', {
          detail: {
            error: {
              type: 'timeout',
              message: 'La conexión es muy lenta',
              rtt: navigator?.connection?.rtt || 'desconocido',
              timeout: 5000,
            },
          },
        })
      );
    }
  });

  // Promesas rechazadas no manejadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);

    const reason = event.reason || {};
    const msg = reason.message || String(reason);
    const esTimeout = msg.includes('timeout') || msg.toLowerCase().includes('network');

    enviarReporteDiagnostico({
      tipo: esTimeout ? 'timeout_red' : 'rechazo_promesa',
      severidad: esTimeout ? 'warning' : 'error',
      mensaje_error: msg,
      stack_trace: extraerStack(reason),
      user_email: currentUserSnapshot.email,
      user_id: currentUserSnapshot.id,
      user_role: currentUserSnapshot.role
    }).catch(() => {});

    if (esTimeout) {
      window.dispatchEvent(
        new CustomEvent('pageError', {
          detail: {
            error: {
              type: 'timeout',
              message: 'La conexión es muy lenta',
            },
          },
        })
      );
    }
  });

  // Detección de pantallas blancas: usa un sentinel marcado por el propio árbol de React.
  // El detector solo dispara si React NO montó el árbol (sentinel ausente Y #root vacío),
  // evitando falsos positivos durante microestados de transición (AnimatePresence, Suspense).
  if (typeof document !== 'undefined') {
    let blankCheckAttempts = 0;
    const checkBlankScreen = () => {
      blankCheckAttempts++;
      if (blankCheckAttempts > 4) return;
      const main = document.querySelector('#root');
      const sentinel = document.getElementById('app-root-mounted');
      const rootVacio = !main || main.children.length === 0;
      const reactNoMontado = !sentinel;
      if (rootVacio && reactNoMontado && document.readyState === 'complete') {
        enviarReporteDiagnostico({
          tipo: 'pantalla_blanca',
          severidad: 'critico',
          mensaje_error: 'React no montó el árbol (#root vacío y sentinel ausente)',
          user_email: currentUserSnapshot.email,
          user_id: currentUserSnapshot.id,
          user_role: currentUserSnapshot.role
        }).catch(() => {});
      } else {
        setTimeout(checkBlankScreen, 2000);
      }
    };
    setTimeout(checkBlankScreen, 3000);
  }
}