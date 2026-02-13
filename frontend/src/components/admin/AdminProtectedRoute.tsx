import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);

    if (user.user_type !== 'admin') {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <AdminLayout>
        {children}
      </AdminLayout>
    );
  } catch (error) {
    console.error('Error parsing user data:', error);
    return <Navigate to="/login" replace />;
  }
}
