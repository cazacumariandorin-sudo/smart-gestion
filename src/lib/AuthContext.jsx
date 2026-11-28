import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { registrarLoginSesion, registrarLogoutSesion } from '@/lib/diagnosticoUtils';

const AuthContext = createContext();

/**
 * AuthLoadTimeoutError — se lanza cuando auth.me() cuelga más del umbral y
 * existía una sesión previa (P3-z). GlobalErrorBoundary lo captura y ofrece
 * "Recargar" al usuario, distinguiendo un cuelgue de red de una sesión caducada.
 */
export class AuthLoadTimeoutError extends Error {
  constructor(message = 'La sesión tardó demasiado en cargar. Revisa la conexión y recarga.') {
    super(message);
    this.name = 'AuthLoadTimeoutError';
  }
}

/** ¿Existía token de sesión antes de intentar auth.me()? (para decidir P3-z) */
function hadSessionBefore() {
  try {
    if (appParams.token) return true;
    const ls = typeof window !== 'undefined' ? window.localStorage : null;
    if (ls && (ls.getItem('base44_access_token') || ls.getItem('token'))) return true;
  } catch { /* sin-op */ }
  return false;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // P1/A1: estado de carga único. isLoadingAuth/isLoadingPublicSettings se exponen
  // como alias del mismo valor para no romper consumidores existentes.
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const userLoadedRef = useRef(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoading(true);
    setAuthError(null);
    setAppPublicSettings({ id: appParams.appId });

    const hadSession = hadSessionBefore();

    // P3-z: safety timeout híbrido a 10s.
    // - Si había sesión previa: lanzar AuthLoadTimeoutError (probable cuelgue de red → Recargar).
    // - Si no había sesión: mantener auth_required → /login (flujo normal de invitado).
    const timeoutId = setTimeout(() => {
      if (!userLoadedRef.current) {
        console.warn('Auth check timeout - hadSession:', hadSession);
        setIsLoading(false);
        // P3-z: si había sesión, marcamos auth_load_timeout (App.jsx lo convierte en un
        // error de render capturado por GlobalErrorBoundary → "Recargar"). Si no,
        // auth_required → /login (flujo normal de invitado).
        setAuthError(
          hadSession
            ? { type: 'auth_load_timeout', message: 'La sesión tardó demasiado en cargar.' }
            : { type: 'auth_required', message: 'Authentication required' }
        );
      }
    }, 10000);

    try {
      // Always try auth.me() — the SDK manages session tokens internally.
      // appParams.token may be null for returning users authenticated via SDK session.
      const currentUser = await base44.auth.me();
      userLoadedRef.current = true;
      clearTimeout(timeoutId);

      // PATCH: leer el rol actualizado via función getMiRol (usa asServiceRole en backend,
      // evita que RLS con JWT desactualizado impida leer el rol real de la entidad User).
      try {
        const rolData = await base44.functions.invoke('getMiRol', {});
        const entityUser = rolData?.data || rolData;
        if (entityUser && entityUser.role) {
          currentUser.role = entityUser.role;
          currentUser.cargo = entityUser.cargo || currentUser.cargo || '';
          currentUser.tipo_cuenta = entityUser.tipo_cuenta || 'real';
          currentUser.demo_expires_at = entityUser.demo_expires_at || null;
          currentUser.invitado_por = entityUser.invitado_por || null;
          currentUser.acceso_hasta = entityUser.acceso_hasta || null;
          currentUser.vinculo_id = entityUser.vinculo_id || null;
          // Fase 0: identidad unificada — operario_id canónico en sesión
          currentUser.operario_id = entityUser.operario_id || null;
          currentUser.operario_name = entityUser.operario_name || null;
          currentUser.user_entity_id = entityUser.user_entity_id || null;
          // Empresa y propiedad global: gobiernan el aislamiento, así que se
          // refrescan siempre desde la entidad y no solo del token.
          if (entityUser.empresa_id !== undefined) currentUser.empresa_id = entityUser.empresa_id;
          if (entityUser.empresa_nombre !== undefined) currentUser.empresa_nombre = entityUser.empresa_nombre;
          if (entityUser.es_propietario_global !== undefined) {
            currentUser.es_propietario_global = entityUser.es_propietario_global === true;
          }
          if (entityUser.source === 'entity') {
            console.log(`[Auth] Identidad unificada: rol=${entityUser.role} operario_id=${entityUser.operario_id || 'none'} (${currentUser.email})`);
          }
        }
      } catch (roleErr) {
        // Fallback: intentar directamente con filter si la función falla
        console.warn('getMiRol falló, intentando fallback directo:', roleErr.message);
        try {
          const userRecords = await base44.entities.User.filter({ email: currentUser.email.toLowerCase().trim() });
          if (userRecords && userRecords.length > 0) {
            const entityUser = userRecords[0];
            currentUser.role = entityUser.role || currentUser.role || 'operario';
            currentUser.cargo = entityUser.cargo || currentUser.cargo || '';
            currentUser.tipo_cuenta = entityUser.tipo_cuenta || 'real';
            currentUser.demo_expires_at = entityUser.demo_expires_at || null;
            currentUser.invitado_por = entityUser.invitado_por || null;
            currentUser.acceso_hasta = entityUser.acceso_hasta || null;
            currentUser.vinculo_id = entityUser.vinculo_id || null;
            currentUser.user_entity_id = entityUser.id;
          }
        } catch (fallbackErr) {
          console.warn('Role sync fallback también falló, usando rol del token:', fallbackErr.message);
        }
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      try { window.sessionStorage.removeItem('base44_auth_reintento'); } catch { /* sin-op */ }
      // Captura de sesión para diagnóstico (timestamp de login + identidad)
      try {
        registrarLoginSesion({ ...currentUser, metodo_login: 'session_token' });
      } catch { /* sin-op */ }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('User auth check failed:', error);
      // Auto-reparación: un token guardado que ya no vale deja la app en bucle
      // (se inicia sesión y se vuelve a la pantalla de acceso). Se descarta UNA vez
      // y se recarga, para que la sesión nueva de la plataforma se use sin el token viejo.
      const tokenViejo = !!appParams.token;
      let yaReintentado = false;
      try { yaReintentado = window.sessionStorage.getItem('base44_auth_reintento') === '1'; } catch { /* sin-op */ }
      if (tokenViejo && !yaReintentado) {
        try {
          window.sessionStorage.setItem('base44_auth_reintento', '1');
          window.localStorage.removeItem('base44_access_token');
          window.localStorage.removeItem('token');
        } catch { /* sin-op */ }
        window.location.reload();
        return;
      }
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    try { registrarLogoutSesion(); } catch { /* sin-op */ }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      // Alias de compatibilidad (P1/A1): mismo valor, invariante garantizada por construcción.
      isLoadingAuth: isLoading,
      isLoadingPublicSettings: isLoading,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};