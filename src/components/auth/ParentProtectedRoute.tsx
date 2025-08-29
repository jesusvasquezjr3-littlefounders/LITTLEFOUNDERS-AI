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
    
    // Verificar que el usuario sea padre/tutor o patrocinador
    if (user.user_type !== 'tutor' && user.user_type !== 'sponsor') {
      // Si es un niño, redirigir a la página de tareas para niños
      if (user.user_type === 'child') {
        return <Navigate to="/tasks" replace />;
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
