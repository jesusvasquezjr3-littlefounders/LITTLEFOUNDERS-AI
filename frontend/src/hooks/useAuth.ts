import { useCallback } from 'react';
import { getGuestProfile, clearGuestProfile, isGuest as checkIsGuest, type GuestProfile } from '@/lib/guestProfile';
import { supabase } from '@/lib/supabase';
import { apiLogout } from '@/lib/apiClient';

interface AuthUser {
    email: string;
    user_type: string;
    public_id?: string;
    name?: string;
    username?: string;
    [key: string]: unknown;
}

function getAuthUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthUser;
        return parsed.email && parsed.user_type ? parsed : null;
    } catch {
        return null;
    }
}

export function useAuth() {
    const user = getAuthUser();
    const guestProfile: GuestProfile | null = getGuestProfile();
    const isAuthenticated = user !== null;
    const isGuest = !isAuthenticated && checkIsGuest();
    const isAnonymous = !isAuthenticated && !isGuest;

    const displayName: string =
        user?.name ||
        guestProfile?.name ||
        '';

    const userType: string = user?.user_type || (isGuest ? 'guest' : 'anonymous');

    const stats = isAuthenticated
        ? null // auth users pull stats from their own components
        : {
              xp: guestProfile?.xp ?? 0,
              current_streak: guestProfile?.current_streak ?? 0,
              max_streak: guestProfile?.max_streak ?? 0,
              lessons_completed: guestProfile?.lessons_completed ?? 0,
              games_played: guestProfile?.games_played ?? 0,
          };

    const logout = useCallback(() => {
        // Revoke server-side refresh tokens + clear httpOnly cookie.
        apiLogout().catch(() => {});
        // Sign out of Supabase to clear the 'sb-*-auth-token' key.
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }, []);

    const clearAll = useCallback(() => {
        apiLogout().catch(() => {});
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        clearGuestProfile();
    }, []);

    return {
        isAuthenticated,
        isGuest,
        isAnonymous,
        user,
        guestProfile,
        displayName,
        userType,
        stats,
        logout,
        clearAll,
    };
}
