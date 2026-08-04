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

  // Detección de pantallas blancas: si el body está vacío / no.hydrated
  if (typeof document !== 'undefined') {
    let blankCheckAttempts = 0;
    const checkBlankScreen = () => {
      blankCheckAttempts++;
      // Solo revisar en los primeros 8 segundos tras carga, y solo si algo falló
      if (blankCheckAttempts > 4) return;
      const main = document.querySelector('#root');
      if (main && main.children.length === 0 && document.readyState === 'complete') {
        enviarReporteDiagnostico({
          tipo: 'pantalla_blanca',
          severidad: 'critico',
          mensaje_error: 'Render vacío en #root (posible pantalla blanca)',
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