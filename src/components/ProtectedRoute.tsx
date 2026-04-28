
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useMultiTenant } from "@/hooks/useMultiTenant";

const ProtectedRoute = ({ 
  children, 
  adminOnly = false, 
  superAdminOnly = false 
}: { 
  children: React.ReactNode, 
  adminOnly?: boolean,
  superAdminOnly?: boolean
}) => {
  const { session, profile, isLoading, isAdmin, ownedTenants } = useMultiTenant();
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

  // Super Admin bypasses restaurant selection/creation checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Handle Multi-Tenant redirection logic
  if (!profile?.tenant_id && !profile?.restaurant_id) {
    // If user is already on one of the onboarding pages, don't redirect again
    if (location.pathname === '/create-restaurant' || location.pathname === '/select-restaurant') {
      return <>{children}</>;
    }

    // If they own restaurants but haven't selected one, go to selection
    if (ownedTenants && ownedTenants.length > 0) {
      return <Navigate to="/select-restaurant" replace />;
    }

    // If they own nothing, go to creation
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
