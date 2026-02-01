import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Star, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const Bye = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/');
        }, 5000);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900 flex items-center justify-center">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Floating Coins */}
                <div className="absolute top-20 left-10 w-16 h-16 bg-yellow-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
                <div className="absolute top-40 right-20 w-12 h-12 bg-green-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
                <div className="absolute bottom-32 left-1/4 w-20 h-20 bg-blue-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>

                {/* Floating Stars */}
                <Star className="absolute top-1/4 right-1/4 w-8 h-8 text-yellow-300 opacity-30 animate-pulse" />
                <Star className="absolute bottom-1/3 left-1/3 w-6 h-6 text-pink-300 opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
                <Sparkles className="absolute top-1/3 left-1/4 w-10 h-10 text-purple-300 opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />

                {/* Gradient Orbs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl"></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="flex justify-center">
                    <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur-md rounded-full ring-4 ring-white/50 dark:ring-slate-700/50">
                        <Rocket className="w-16 h-16 text-purple-600 dark:text-purple-400 animate-pulse" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
                        {t('common:bye_page.title')}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 font-medium max-w-md mx-auto leading-relaxed">
                        {t('common:bye_page.subtitle')}
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={() => navigate('/')}
                        className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-purple-600 dark:text-purple-400 font-bold px-8 py-6 rounded-full shadow-lg border-2 border-purple-200 dark:border-purple-500/50 transition-all hover:scale-105"
                    >
                        {t('common:bye_page.back_home')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Bye;
