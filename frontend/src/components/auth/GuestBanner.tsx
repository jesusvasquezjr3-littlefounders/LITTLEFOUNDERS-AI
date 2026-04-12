import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { X, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGuestProfile } from "@/lib/guestProfile";
import { cn } from "@/lib/utils";

export function GuestBanner() {
    const { t } = useTranslation('dashboard');
    const [dismissed, setDismissed] = useState(false);
    const guest = getGuestProfile();

    if (dismissed || !guest) return null;

    return (
        <div className={cn(
            // Layout
            "relative flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-4 overflow-hidden",
            // Light mode glass
            "bg-gradient-to-r from-violet-50/90 to-indigo-50/90",
            "border border-violet-200/60",
            // Dark mode glass
            "dark:from-violet-950/60 dark:to-indigo-950/60",
            "dark:border-violet-500/20",
            // Blur
            "backdrop-blur-xl",
            // Shadow
            "shadow-lg shadow-violet-500/10 dark:shadow-violet-500/5",
            // Animation
            "animate-in fade-in slide-in-from-top-2 duration-500"
        )}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none dark:via-white/5" />

            <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
                <div className={cn(
                    "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                    "bg-violet-100 dark:bg-violet-900/50",
                    "border border-violet-200/50 dark:border-violet-700/30"
                )}>
                    <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
                        {t('guest.banner_title')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {t('guest.banner_description', { xp: guest.xp, streak: guest.current_streak })}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 relative z-10">
                <Button asChild size="sm" className={cn(
                    "text-xs h-8 rounded-xl font-bold",
                    "bg-gradient-to-r from-violet-600 to-indigo-600",
                    "hover:from-violet-700 hover:to-indigo-700",
                    "text-white shadow-md shadow-violet-500/25",
                    "border border-white/10"
                )}>
                    <Link to="/register">
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        {t('guest.banner_cta')}
                    </Link>
                </Button>
                <button
                    onClick={() => setDismissed(true)}
                    className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                        "text-slate-400 dark:text-slate-500",
                        "hover:text-slate-600 dark:hover:text-slate-300",
                        "hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    )}
                    aria-label={t('common:buttons.close')}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
