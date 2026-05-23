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

      // PATCH: leer el rol actualizado de la entidad User
      // base44.auth.me() devuelve el token JWT original que puede tener el rol viejo.
      // Al consultar la entidad User por email obtenemos el rol real y actualizado.
      try {
        const userRecords = await base44.entities.User.filter({ email: currentUser.email });
        if (userRecords && userRecords.length > 0) {
          const entityUser = userRecords[0];
          // Sobreescribir campos que pueden haber cambiado desde el registro inicial
          currentUser.role = entityUser.role || currentUser.role || 'operario';
          currentUser.cargo = entityUser.cargo || currentUser.cargo || '';
          currentUser.tipo_cuenta = entityUser.tipo_cuenta || 'real';
          currentUser.demo_expires_at = entityUser.demo_expires_at || null;
          currentUser.invitado_por = entityUser.invitado_por || null;
          currentUser.acceso_hasta = entityUser.acceso_hasta || null;
          currentUser.vinculo_id = entityUser.vinculo_id || null;
          // Guardar el id de la entidad User para referencias posteriores
          currentUser.user_entity_id = entityUser.id;
        }
      } catch (roleErr) {
        // Si falla la query de rol (sin permisos, red, etc.) usar el del token
        console.warn('Role sync from entity failed, using token role:', roleErr);
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