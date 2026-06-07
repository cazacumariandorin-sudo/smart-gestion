import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';

/**
 * Wraps a page route and redirects to /login if unauthenticated,
 * or to "/" if the user doesn't have access to the given module.
 */
export default function ProtectedRoute({ module, children }) {
  const { isLoadingAuth, user, isAuthenticated } = useAuth();
  const { canAccess } = useUserRole();
  const location = useLocation();

  // Still loading auth — don't decide yet
  if (isLoadingAuth) return null;

  // Not authenticated — send to /login preserving intended destination
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (module && !canAccess(module)) {
    return <Navigate to="/" replace />;
  }

  return children;
}