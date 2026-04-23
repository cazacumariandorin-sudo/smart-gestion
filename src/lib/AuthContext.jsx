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
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: appParams.appId });

      if (appParams.token) {
        try {
          await checkUserAuth();
        } catch (err) {
          console.error('User auth failed:', err);
          setIsLoadingAuth(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }

      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      setAppPublicSettings({ id: appParams.appId });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    userLoadedRef.current = false;

    // Timeout safety: if auth.me() hangs for more than 8s, force redirect to login
    const timeoutId = setTimeout(() => {
      if (!userLoadedRef.current) {
        console.warn('Auth check timeout - redirecting to login');
        setIsLoadingAuth(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }, 8000);

    try {
      const currentUser = await base44.auth.me();
      userLoadedRef.current = true;
      clearTimeout(timeoutId);
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
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