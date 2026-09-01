import { Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";

export default function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-bg"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_staff) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
