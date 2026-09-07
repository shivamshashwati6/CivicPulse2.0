import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Loader2 } from 'lucide-react';

export function AdminRoute() {
  const { isAdmin, user, loading } = useAuth();
  const toast = useToast();

  const userRole = isAdmin
    ? 'admin'
    : user?.role || user?.user_metadata?.role || 'citizen';

  const hasAdminAccess = isAdmin || userRole === 'admin';

  useEffect(() => {
    if (!loading && !hasAdminAccess) {
      toast.error('Unauthorized access: Admin privileges required.');
    }
  }, [loading, hasAdminAccess, toast]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Requirement: If a citizen manually tries to access /admin, cleanly redirect to /dashboard with unauthorized alert
  if (!hasAdminAccess) {
    const redirectTarget = user ? '/dashboard' : '/admin/login';
    return <Navigate to={redirectTarget} replace />;
  }

  return <Outlet />;
}
