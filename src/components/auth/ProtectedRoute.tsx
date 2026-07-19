import { ReactNode, lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { NAV_ACCESS, SOCRole } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

const NotFound = lazy(() => import('@/pages/NotFound'));

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: SOCRole;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  // Check NAV_ACCESS for current path
  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0];
  const allowedRoles = NAV_ACCESS[basePath] || NAV_ACCESS[location.pathname];
  
  if (allowedRoles && role && !allowedRoles.includes(role as SOCRole)) {
    return (
      <Suspense fallback={null}>
        <NotFound />
      </Suspense>
    );
  }

  // Check role hierarchy requirement
  if (requiredRole && role) {
    const roleHierarchy: Record<SOCRole, number> = {
      admin: 6,
      soc_tier_1: 1,
      soc_tier_2: 2,
      soc_tier_3: 3,
      soc_manager: 4,
      grc_engineer: 3,
      ciso: 5,
      demo_user: 0,
    };
    
    const userLevel = roleHierarchy[role as SOCRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return (
        <Suspense fallback={null}>
          <NotFound />
        </Suspense>
      );
    }
  }

  return <>{children}</>;
}
