import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getTranslatedError } from '@/utils/errorUtils';
import { useSound } from '@/contexts/SoundContext';

const DiscordCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useTranslation(['auth', 'errors']);
    const { playSound } = useSound();
    const [isProcessing, setIsProcessing] = useState(true);
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        processedRef.current = true;

        const code = searchParams.get('code');
        const mode = sessionStorage.getItem('discord_auth_mode') || 'mixed';

        if (!code) {
            navigate('/login');
            return;
        }

        const handleDiscordAuth = async () => {
            try {
                const response = await fetch(`${API_URL}/auth/discord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code, mode }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('token', data.access_token);

                    playSound('auth_success');

                    // If register mode or new user
                    if (data.is_new_user) {
                        toast({
                            title: t('auth:messages.register_success'),
                            description: t('auth:messages.register_success_subtitle'),
                            className: "bg-green-50 border-green-200 text-green-800"
                        });
                        navigate('/welcome');
                    } else {
                        toast({
                            title: t('auth:messages.login_success', { name: data.user.name }),
                            description: t('auth:messages.login_success_subtitle'),
                            className: "bg-green-50 border-green-200 text-green-800"
                        });
                        navigate('/dashboard');
                    }
                } else {
                    playSound('auth_error');
                    throw new Error(getTranslatedError(data.detail, t));
                }
            } catch (error) {
                console.error('Discord Auth Error:', error);
                playSound('auth_error');
                toast({
                    title: t('auth:messages.login_error'),
                    description: error instanceof Error ? error.message : "Discord Login Failed",
                    variant: "destructive",
                });
                // Redirect back to login or register based on mode
                if (mode === 'register') {
                    navigate('/register');
                } else {
                    navigate('/login');
                }
            } finally {
                setIsProcessing(false);
                sessionStorage.removeItem('discord_auth_mode');
            }
        };

        handleDiscordAuth();
    }, [searchParams, navigate, toast, t, playSound]);

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

export default DiscordCallback;
