import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegistrationPromptModalProps {
    open: boolean;
    onClose: () => void;
}

export function RegistrationPromptModal({ open, onClose }: RegistrationPromptModalProps) {
    const { t } = useTranslation('dashboard');

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={cn(
                "relative z-10 w-full max-w-sm",
                "backdrop-blur-2xl bg-background/90 border border-white/10",
                "rounded-3xl p-6 shadow-2xl",
                "animate-in fade-in zoom-in-95 duration-300"
            )}>
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-primary" />
                    </div>

                    <div>
                        <h3 className="text-lg font-black text-foreground">{t('guest.feature_requires_account_title')}</h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t('guest.feature_requires_account_body')}</p>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                        <Button asChild className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-purple-500/20">
                            <Link to="/signup" onClick={onClose}>{t('guest.create_account')}</Link>
                        </Button>
                        <Button variant="ghost" onClick={onClose} className="w-full rounded-xl text-muted-foreground hover:text-foreground">
                            {t('guest.continue_exploring')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
