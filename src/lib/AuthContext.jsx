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