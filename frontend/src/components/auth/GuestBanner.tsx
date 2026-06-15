import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { X, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGuestProfile } from "@/lib/guestProfile";

export function GuestBanner() {
    const { t } = useTranslation('dashboard');
    const [dismissed, setDismissed] = useState(false);
    const guest = getGuestProfile();

    if (dismissed || !guest) return null;

    return (
        <div className="relative flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-4 border bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200 leading-tight truncate">
                        {t('guest.banner_title')}
                    </p>
                    <p className="text-xs text-amber-700/90 dark:text-amber-300/80 leading-tight mt-0.5">
                        {t('guest.banner_description', { xp: guest.xp, streak: guest.current_streak })}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Button asChild size="sm" className="text-xs h-8 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm shadow-amber-500/30">
                    <Link to="/signup">
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        {t('guest.banner_cta')}
                    </Link>
                </Button>
                <button
                    onClick={() => setDismissed(true)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-amber-600/70 dark:text-amber-400/60 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                    aria-label={t('common:buttons.close')}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
