/**
 * LanguageSelector Component
 * 
 * A dropdown component for switching between available languages.
 * Can be placed in navigation, settings, or footer.
 * 
 * Features:
 * - Syncs with backend for authenticated users
 * - Persists to localStorage for anonymous users
 * 
 * Usage:
 * ```tsx
 * <LanguageSelector />
 * <LanguageSelector variant="minimal" />
 * ```
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/hooks/useLanguage';
import { useUserLanguage } from '@/hooks/useUserLanguage';
import { cn } from '@/lib/utils';
import { SupportedLanguage } from '@/i18n';

interface LanguageSelectorProps {
    /**
     * Display variant
     * - "full": Shows flag + language name
     * - "minimal": Shows only indicator icon
     * - "pill": Shows flag + short code, stylized as a pill
     */
    variant?: 'full' | 'minimal' | 'pill';
    className?: string;
}

export function LanguageSelector({
    variant = 'full',
    className,
}: LanguageSelectorProps) {
    const { currentLanguageInfo, languages, isCurrentLanguage } = useLanguage();
    const { saveLanguagePreference } = useUserLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const handleLanguageChange = async (langCode: string) => {
        // Save to backend (if authenticated) and update locally
        await saveLanguagePreference(langCode as SupportedLanguage);
        setIsOpen(false);
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={variant === 'pill' ? "outline" : "ghost"}
                    size={variant === 'minimal' ? 'icon' : variant === 'pill' ? 'default' : 'sm'}
                    className={cn(
                        'gap-2 text-muted-foreground hover:text-foreground transition-all duration-200',
                        variant === 'pill' && 'rounded-full border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-6 shadow-sm font-bold hover:bg-white dark:hover:bg-slate-700 hover:text-pink-600 h-10',
                        className
                    )}
                >
                    {variant === 'minimal' ? (
                        <span className="text-base leading-none">{currentLanguageInfo.flag}</span>
                    ) : variant === 'pill' ? (
                        <>
                            <span className="text-base leading-none">{currentLanguageInfo.flag}</span>
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {currentLanguageInfo.code}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">{currentLanguageInfo.flag}</span>
                            <span className="text-sm font-medium">
                                {currentLanguageInfo.name}
                            </span>
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={cn(
                            'gap-2 cursor-pointer',
                            isCurrentLanguage(lang.code) && 'bg-accent'
                        )}
                    >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-sm">{lang.name}</span>
                        {isCurrentLanguage(lang.code) && (
                            <span className="ml-auto text-primary">✓</span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LanguageSelector;
