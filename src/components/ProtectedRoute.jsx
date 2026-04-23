import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';

/**
 * Wraps a page route and redirects to "/" if the current user
 * doesn't have access to the given module key.
 */
export default function ProtectedRoute({ module, children }) {
  const { isLoadingAuth } = useAuth();
  const { canAccess, isLoading } = useUserRole();

  // Wait for both auth context AND the role query to resolve
  if (isLoadingAuth || isLoading) return null;

  if (!canAccess(module)) {
    return <Navigate to="/" replace />;
  }

  return children;
}