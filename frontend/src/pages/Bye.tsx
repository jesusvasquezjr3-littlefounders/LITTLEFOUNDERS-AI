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
            <div className="relative z-10 text-center space-y-7 p-10 sm:p-14 bg-white dark:bg-[#0d1426] rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.04)] max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center">
                    <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/8 rounded-full">
                        <Rocket className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-float" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="corp-h1">
                        {t('common:bye_page.title')}
                    </h1>
                    <p className="corp-subtitle max-w-md mx-auto">
                        {t('common:bye_page.subtitle')}
                    </p>
                </div>

                <div className="pt-3">
                    <Button
                        onClick={() => navigate('/')}
                        className="corp-btn-primary h-12 rounded-full px-8 text-sm font-semibold inline-flex items-center justify-center transition-[transform,filter,box-shadow] duration-160"
                    >
                        {t('common:bye_page.back_home')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Bye;
