import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';

/**
 * Wraps a page route and redirects to "/" if the current user
 * doesn't have access to the given module key.
 */
export default function ProtectedRoute({ module, children }) {
  const { isLoadingAuth, user, isAuthenticated } = useAuth();
  const { canAccess } = useUserRole();

  // Still loading auth — don't decide yet
  if (isLoadingAuth) return null;

  // Auth loaded but no user — redirect to login handled by AuthenticatedApp
  if (!isAuthenticated || !user) return null;

  if (!canAccess(module)) {
    return <Navigate to="/" replace />;
  }

  return children;
}