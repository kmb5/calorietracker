import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Wraps protected routes. Redirects to /login when unauthenticated.
 * Shows nothing while the initial silent-refresh is in progress.
 */
export function ProtectedRoute() {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Render nothing (or a full-screen spinner) while we attempt silent refresh
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * Wraps public-only routes (/login, /register).
 * Redirects authenticated users to home.
 */
export function PublicOnlyRoute() {
  const { accessToken, loading } = useAuth();

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
