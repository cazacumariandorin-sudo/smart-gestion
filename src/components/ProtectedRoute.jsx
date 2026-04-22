import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';

/**
 * Wraps a page route and redirects to "/" if the current user
 * doesn't have access to the given module key.
 */
export default function ProtectedRoute({ module, children }) {
  const { canAccess, isLoading } = useUserRole();

  if (isLoading) return null; // wait silently — AppLayout already shows a spinner at auth level

  if (!canAccess(module)) {
    return <Navigate to="/" replace />;
  }

  return children;
}