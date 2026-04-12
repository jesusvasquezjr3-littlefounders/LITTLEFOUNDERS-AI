import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isGuest } from "@/lib/guestProfile";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When true, only authenticated users are allowed (guests are redirected to /login).
   *  When false (default), authenticated users AND guests with completed onboarding are allowed.
   *  Anonymous users (no auth, no guest profile) are always redirected to /onboarding. */
  requireAuth?: boolean;
}

export function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    let isAuthenticated = false;

    if (userRaw) {
      try {
        const userData = JSON.parse(userRaw);
        if (userData.email && userData.user_type) {
          isAuthenticated = true;
        } else {
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('user');
      }
    }

    if (isAuthenticated) {
      setAllowed(true);
    } else if (!requireAuth && isGuest()) {
      // Guest with completed onboarding can access non-auth-required routes
      setAllowed(true);
    } else if (requireAuth) {
      // Auth-only route — send to login
      navigate('/login');
    } else {
      // No session at all — start onboarding
      navigate('/onboarding');
    }

    setIsLoading(false);
  }, [navigate, requireAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('status.verifying_auth')}</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
