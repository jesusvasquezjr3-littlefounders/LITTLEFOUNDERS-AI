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
      // Si es padre/tutor o patrocinador, redirigir a la página de gestión de tareas
      if (user.user_type === 'tutor' || user.user_type === 'sponsor') {
        return <Navigate to="/parent-tasks" replace />;
      }
      // Para otros tipos de usuario, redirigir al dashboard
      return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return <Navigate to="/login" replace />;
  }
}
