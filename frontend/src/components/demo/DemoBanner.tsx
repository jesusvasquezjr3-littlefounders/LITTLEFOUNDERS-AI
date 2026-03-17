import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/GlassPanel";
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
        <div className="bg-indigo-400/10 dark:bg-indigo-400/5 border border-indigo-400/20 h-10 px-3 rounded-xl flex items-center justify-between gap-3 mb-3 animate-in fade-in slide-in-from-top-2 duration-700 overflow-hidden">
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                <div className="relative flex-1 overflow-hidden whitespace-nowrap">
                    <p className="inline-block text-[9px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 animate-marquee sm:animate-none">
                        {message}
                    </p>
                    {/* Invisible copy for smooth loop if we were using a more complex marquee, 
                        but for now a simple overflow-hidden with sm:animate-none works for basic slimness */}
                </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/login')}
                    className="h-6 px-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 transition-all"
                >
                    {t('nav.login')}
                </Button>
                <Button
                    size="sm"
                    onClick={() => navigate('/register')}
                    className="h-6 px-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-[8px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 border-none transition-all active:scale-95"
                >
                    {t('nav.register')}
                </Button>
            </div>
            
            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                    display: inline-block;
                    padding-left: 20px;
                    animation: marquee 15s linear infinite;
                }
                @media (min-width: 640px) {
                    .animate-marquee {
                        animation: none;
                        padding-left: 0;
                        transform: none;
                        white-space: normal;
                    }
                }
            `}</style>
        </div>
    );
}
