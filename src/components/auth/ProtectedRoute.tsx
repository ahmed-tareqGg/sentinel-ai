import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { NAV_ACCESS, SOCRole } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: SOCRole;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

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
    return <Navigate to="/auth" replace />;
  }

  // Check role requirements using the role hierarchy
  if (requiredRole && role) {
    const roleHierarchy: Record<SOCRole, number> = {
      soc_tier_1: 1,
      soc_tier_2: 2,
      soc_tier_3: 3,
      soc_manager: 4,
      grc_engineer: 3, // GRC is parallel to Tier 3 in hierarchy
      ciso: 5,
    };
    
    const userLevel = roleHierarchy[role as SOCRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Required role: {requiredRole}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
