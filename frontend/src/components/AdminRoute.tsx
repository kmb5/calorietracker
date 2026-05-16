import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Wraps `/admin/*` routes.
 * - Unauthenticated → /login
 * - Authenticated but non-admin → / (home)
 * - Admin → renders child routes
 */
export function AdminRoute() {
  const { accessToken, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
