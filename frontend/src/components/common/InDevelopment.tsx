import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hammer, ArrowLeft, Construction } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const InDevelopment = () => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-6 animate-fade-in">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative bg-white dark:bg-slate-800 p-6 rounded-full shadow-xl border-4 border-blue-100 dark:border-blue-900">
                    <Construction className="w-16 h-16 text-blue-500 animate-bounce-slow" />
                </div>
            </div>

            <div className="max-w-md space-y-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {t('in_development.title')}
                </h2>
                <p className="text-muted-foreground text-lg">
                    {t('in_development.description')}
                </p>
            </div>
            <div className="flex flex-col items-center gap-4">
                <Button
                    onClick={() => navigate('/learn')}
                    size="lg"
                    className="rounded-full px-8 shadow-lg hover:shadow-blue-500/25 transition-all"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('in_development.back_home')}
                </Button>
            </div>
        </div >
    );
};
