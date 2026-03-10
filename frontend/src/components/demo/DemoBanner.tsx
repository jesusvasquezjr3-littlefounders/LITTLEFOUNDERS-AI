import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn, UserPlus, Info } from "lucide-react";

interface DemoBannerProps {
    message: string;
}

export function DemoBanner({ message }: DemoBannerProps) {
    const navigate = useNavigate();
    const { t } = useTranslation('demo');

    return (
        <div className="relative mb-6 p-3 px-5 rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-lg backdrop-blur-md bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-purple-600/10 animate-in fade-in slide-in-from-top-2 duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-400/20">
                        <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {message}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/login')}
                        className="h-8 rounded-lg border border-white/10 hover:bg-white/10 text-xs text-slate-600 dark:text-slate-300"
                    >
                        <LogIn className="w-3.5 h-3.5 mr-1.5" />
                        {t('nav.login')}
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => navigate('/register')}
                        className="h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs text-white shadow-md shadow-blue-500/20 border-none"
                    >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        {t('nav.register')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
