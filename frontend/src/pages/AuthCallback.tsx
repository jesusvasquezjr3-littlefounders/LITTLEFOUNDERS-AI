import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getTranslatedError } from '@/utils/errorUtils';
import { useSound } from '@/contexts/SoundContext';
import { savePendingMerge, clearPendingMerge } from '@/lib/guestProfile';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { t } = useTranslation(['auth', 'errors']);
    const { playSound } = useSound();
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        processedRef.current = true;

        const handleCallback = async () => {
            // ── Clear any stale Supabase session from a previous user ──────────
            // When User X logs out without calling signOut(), their Supabase session
            // key ('sb-*-auth-token') stays in localStorage. On this same browser,
            // if User Y starts an OAuth login, supabase.auth.getSession() may return
            // User X's cached session, causing User Y to be logged in as User X.
            //
            // scope: 'local' clears only localStorage — no network request, no
            // server-side token revocation — so it's safe to call here before we
            // even know what the new session is.
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

            // Guard against both onAuthStateChange AND getSession fallback running simultaneously.
            // Only the first path to reach the exchange wins.
            let sessionProcessed = false;

            /**
             * Safely merges a guest profile into the newly-authenticated account.
             * - Saves a backup key BEFORE removing the main guest key.
             * - Clears the backup only on a confirmed 2xx response.
             * - On failure, the backup key stays so Index.tsx can retry on next load.
             * - On success, applies an optimistic XP/streak update to localStorage
             *   so the dashboard shows progress immediately without an extra refetch.
             */
            const mergeGuestIfPresent = async (appToken: string, storedUser: Record<string, unknown>) => {
                const guestRaw = localStorage.getItem('lf_guest_profile');
                if (!guestRaw) return storedUser;
                try {
                    const gp = JSON.parse(guestRaw);
                    savePendingMerge(gp);
                    localStorage.removeItem('lf_guest_profile');
                    try {
                        const mergeRes = await fetch(`${API_URL}/auth/merge-guest`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
                            body: JSON.stringify({
                                name: gp.name,
                                age: gp.age,
                                interests: gp.interests,
                                experience_level: gp.experience_level,
                                preferred_language: gp.preferred_language,
                                xp: gp.xp,
                                current_streak: gp.current_streak ?? 1,
                                steps_completed: 5,
                            }),
                        });
                        if (mergeRes.ok) {
                            clearPendingMerge();
                            // Optimistic update: add guest XP/streak to local user object
                            return {
                                ...storedUser,
                                points_earned: ((storedUser.points_earned as number) || 0) + (gp.xp || 0),
                                current_streak: Math.max((storedUser.current_streak as number) || 0, gp.current_streak || 1),
                                max_streak: Math.max((storedUser.max_streak as number) || 0, gp.max_streak || 1),
                            };
                        }
                    } catch { /* network failure — backup key stays for retry */ }
                } catch { /* JSON parse failed — skip */ }
                return storedUser;
            };

            try {
                // Check if this is a password recovery flow
                const type = searchParams.get('type');

                // Listen for the auth event to determine the type
                const { data: { subscription } } = supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        if (sessionProcessed) { subscription.unsubscribe(); return; }
                        sessionProcessed = true;
                        subscription.unsubscribe();

                        if (event === 'PASSWORD_RECOVERY' || type === 'recovery') {
                            navigate('/reset-password');
                            return;
                        }

                        if (!session) {
                            throw new Error('No se encontró sesión de Supabase');
                        }

                        // Exchange the Supabase access token for an app token
                        const response = await fetch(`${API_URL}/auth/supabase`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ access_token: session.access_token }),
                        });

                        const data = await response.json();

                        if (response.ok) {
                            const mergedUser = await mergeGuestIfPresent(data.access_token, data.user);
                            localStorage.setItem('user', JSON.stringify(mergedUser));
                            localStorage.setItem('token', data.access_token);

                            playSound('auth_success');

                            if (data.is_new_user) {
                                toast({
                                    title: t('auth:messages.register_success'),
                                    description: t('auth:messages.register_success_subtitle'),
                                    className: 'bg-green-50 border-green-200 text-green-800',
                                });
                            } else {
                                toast({
                                    title: t('auth:messages.login_success', { name: data.user.name }),
                                    description: t('auth:messages.login_success_subtitle'),
                                    className: 'bg-green-50 border-green-200 text-green-800',
                                });
                            }
                            navigate('/learn');
                        } else {
                            throw new Error(getTranslatedError(data.detail, t));
                        }
                    }
                );

                // Also try getSession as fallback for OAuth providers
                // that put session in URL hash (not via onAuthStateChange)
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    throw new Error(error.message);
                }

                // If session exists and the event listener hasn't processed it yet,
                // process it here (this handles OAuth redirects with hash fragments)
                if (session && !type && !sessionProcessed) {
                    sessionProcessed = true;

                    const response = await fetch(`${API_URL}/auth/supabase`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_token: session.access_token }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                        const mergedUser = await mergeGuestIfPresent(data.access_token, data.user);
                        localStorage.setItem('user', JSON.stringify(mergedUser));
                        localStorage.setItem('token', data.access_token);

                        playSound('auth_success');

                        if (data.is_new_user) {
                            toast({
                                title: t('auth:messages.register_success'),
                                description: t('auth:messages.register_success_subtitle'),
                                className: 'bg-green-50 border-green-200 text-green-800',
                            });
                        } else {
                            toast({
                                title: t('auth:messages.login_success', { name: data.user.name }),
                                description: t('auth:messages.login_success_subtitle'),
                                className: 'bg-green-50 border-green-200 text-green-800',
                            });
                        }
                        navigate('/learn');
                    } else {
                        throw new Error(getTranslatedError(data.detail, t));
                    }
                }
            } catch (error) {
                console.error('Auth callback error:', error);
                playSound('auth_error');
                toast({
                    title: t('auth:messages.login_error'),
                    description: error instanceof Error ? error.message : t('auth:messages.login_error_detail'),
                    variant: 'destructive',
                });
                navigate('/login');
            }
        };

        handleCallback();
    }, [navigate, searchParams, toast, t, playSound]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('auth:login.loading')}
                </h2>
            </div>
        </div>
    );
};

export default AuthCallback;
