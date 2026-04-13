import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ChildProtectedRouteProps {
  children: ReactNode;
}

export function ChildProtectedRoute({ children }: ChildProtectedRouteProps) {
  // Obtener información del usuario desde localStorage
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);

    // Verificar que el usuario sea un niño
    if (user.user_type !== 'child') {
      // Si es padre/tutor, redirigir a la página de gestión de tareas
      if (user.user_type === 'tutor') {
        return <Navigate to="/admin/dashboard" replace />;
      }// Para otros tipos de usuario, redirigir a /learn
      return <Navigate to="/learn" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error analizando datos de usuario:', error);
    return <Navigate to="/login" replace />;
  }
}
