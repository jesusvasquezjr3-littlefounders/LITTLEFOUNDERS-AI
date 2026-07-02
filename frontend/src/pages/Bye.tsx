import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
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
        <div className="corp min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a] flex items-center justify-center">
            {/* Main Content */}
            <div className="relative z-10 text-center space-y-8 p-8 sm:p-12 bg-white dark:bg-[#0d1426] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-700">
                <div className="flex justify-center">
                    <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full">
                        <Rocket className="w-16 h-16 text-indigo-600" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="corp-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                        {t('common:bye_page.title')}
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        {t('common:bye_page.subtitle')}
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={() => navigate('/')}
                        className="corp-btn-primary h-12 rounded-full px-8 text-sm font-semibold inline-flex items-center justify-center"
                    >
                        {t('common:bye_page.back_home')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Bye;
