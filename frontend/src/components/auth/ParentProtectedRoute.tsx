import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ParentProtectedRouteProps {
  children: ReactNode;
}

export function ParentProtectedRoute({ children }: ParentProtectedRouteProps) {
  // Obtener información del usuario desde localStorage
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);

    // Verificar que el usuario sea padre/tutor
    if (user.user_type !== 'tutor') {
      // Si es un niño, redirigir a la página de tareas para niños
      if (user.user_type === 'child') {
        return <Navigate to="/tasks" replace />;
      }
      // Para otros tipos de usuario, redirigir al dashboard
      return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error analizando datos de usuario:', error);
    return <Navigate to="/login" replace />;
  }
}
