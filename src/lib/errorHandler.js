export function setupGlobalErrorHandling() {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (event.error?.message?.includes('timeout')) {
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

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    
    if (event.reason?.message?.includes('timeout')) {
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
}