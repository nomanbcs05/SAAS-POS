import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { cashierApi, ALL_MODULES } from "@/services/cashierApi";

const ProtectedRoute = ({
  children,
  adminOnly = false,
  superAdminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) => {
  const { session, profile, isLoading, isAdmin, isCashierLogin, canAccess, tenant } = useMultiTenant();
  const location = useLocation();

  const isSuperAdmin = profile?.role === 'super-admin';

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isCashier = isCashierLogin || profile?.role === 'cashier';

  if (isCashier) {
    if (superAdminOnly) {
      return <Navigate to="/pos" replace />;
    }

    // CASHIER CANNOT: Settings, Users (Staff Management), Reports, Admin Dashboard
    const blockedForCashier = ['/settings', '/staff-management', '/reports', '/saas-admin', '/pos-dashboard'];
    const isBlocked = blockedForCashier.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
    if (isBlocked || adminOnly) {
      return <Navigate to="/pos" replace />;
    }

    const mod = ALL_MODULES.find(
      m => m.route === location.pathname || (location.pathname !== '/' && location.pathname !== '/pos' && location.pathname.startsWith(m.route + '/'))
    );
    if (mod && !canAccess(mod.key)) {
      return <Navigate to="/pos" replace />;
    }

    return <>{children}</>;
  }

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (!profile?.tenant_id && !profile?.restaurant_id) {
    if (location.pathname === '/create-restaurant' || location.pathname === '/select-restaurant') {
      return <>{children}</>;
    }
    return <Navigate to="/create-restaurant" replace />;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
