import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const userLoadedRef = useRef(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);
    setAuthError(null);
    setAppPublicSettings({ id: appParams.appId });

    // Safety timeout: if auth.me() hangs, redirect to login rather than
    // showing a blank screen or incorrectly treating user as unauthenticated.
    const timeoutId = setTimeout(() => {
      if (!userLoadedRef.current) {
        console.warn('Auth check timeout - redirecting to login');
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }, 8000);

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
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = (shouldRedirect = true) => {
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
      isLoadingAuth,
      isLoadingPublicSettings,
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