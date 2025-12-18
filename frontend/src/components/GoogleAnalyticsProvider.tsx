import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGoogleAnalytics, trackPageView } from '@/lib/googleAnalytics';

interface GoogleAnalyticsProviderProps {
  children: React.ReactNode;
}

/**
 * Google Analytics Provider Component
 * 
 * Wraps the application to provide automatic page view tracking
 * for React Router navigation changes.
 */
export const GoogleAnalyticsProvider = ({ children }: GoogleAnalyticsProviderProps) => {
  const location = useLocation();

  // Initialize Google Analytics on mount
  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    // Get page title based on path
    const getPageTitle = (pathname: string): string => {
      const titles: Record<string, string> = {
        '/': 'Inicio',
        '/dashboard': 'Dashboard',
        '/welcome': 'Bienvenida',
        '/login': 'Iniciar Sesión',
        '/register': 'Registro',
        '/lecciones': 'Lecciones',
        '/profile': 'Perfil',
        '/tasks': 'Tareas',
        '/parent-tasks': 'Tareas de Padres',
        '/growth': 'Crecimiento',
        '/savings': 'Ahorros',
        '/store': 'Tienda',
        '/investment-games': 'Juegos de Inversión',
        '/lemonade-stand': 'Puesto de Limonada',
        '/demo': 'Demo',
        '/demo/lemonade-stand': 'Demo - Puesto de Limonada',
        '/demo/lecciones': 'Demo - Lecciones',
        '/demo/lecciones/1': 'Demo - Lección 1',
        '/demo/card': 'Demo - Tarjeta Virtual',
        '/demo/growth': 'Demo - Crecimiento',
        '/demo/investment-games': 'Demo - Juegos de Inversión',
        '/demo/savings': 'Demo - Ahorros',
        '/demo/store': 'Demo - Tienda',
        '/demo/tasks': 'Demo - Tareas',
      };
      return titles[pathname] || 'Little Founders';
    };

    trackPageView(location.pathname, getPageTitle(location.pathname));
  }, [location]);

  return <>{children}</>;
};
