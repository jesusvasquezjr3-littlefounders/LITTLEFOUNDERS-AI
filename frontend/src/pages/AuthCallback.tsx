import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getTranslatedError } from '@/utils/errorUtils';
import { useSound } from '@/contexts/SoundContext';

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
            try {
                // Check if this is a password recovery flow
                const type = searchParams.get('type');

                // Listen for the auth event to determine the type
                const { data: { subscription } } = supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        subscription.unsubscribe();

                        if (event === 'PASSWORD_RECOVERY' || type === 'recovery') {
                            // Redirect to reset password page
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
                            localStorage.setItem('user', JSON.stringify(data.user));
                            localStorage.setItem('token', data.access_token);

                            playSound('auth_success');

                            if (data.is_new_user) {
                                toast({
                                    title: t('auth:messages.register_success'),
                                    description: t('auth:messages.register_success_subtitle'),
                                    className: 'bg-green-50 border-green-200 text-green-800',
                                });
                                navigate('/welcome');
                            } else {
                                toast({
                                    title: t('auth:messages.login_success', { name: data.user.name }),
                                    description: t('auth:messages.login_success_subtitle'),
                                    className: 'bg-green-50 border-green-200 text-green-800',
                                });
                                navigate('/dashboard');
                            }
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

                // If session exists and we haven't been handled by the event listener,
                // process it (this handles OAuth redirects)
                if (session && !type) {
                    const response = await fetch(`${API_URL}/auth/supabase`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_token: session.access_token }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        localStorage.setItem('token', data.access_token);

                        playSound('auth_success');

                        if (data.is_new_user) {
                            toast({
                                title: t('auth:messages.register_success'),
                                description: t('auth:messages.register_success_subtitle'),
                                className: 'bg-green-50 border-green-200 text-green-800',
                            });
                            navigate('/welcome');
                        } else {
                            toast({
                                title: t('auth:messages.login_success', { name: data.user.name }),
                                description: t('auth:messages.login_success_subtitle'),
                                className: 'bg-green-50 border-green-200 text-green-800',
                            });
                            navigate('/dashboard');
                        }
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
