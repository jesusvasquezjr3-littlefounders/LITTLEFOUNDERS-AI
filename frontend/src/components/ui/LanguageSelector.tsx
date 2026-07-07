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
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
    /**
     * Display variant
     * - "full": Shows flag + language name
     * - "minimal": Shows only indicator icon
     * - "pill": Shows flag + short code, stylized as a pill
     * - "simple": Shows globe icon + uppercase code + chevron
     */
    variant?: 'full' | 'minimal' | 'pill' | 'simple';
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
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'relative gap-2 corp-panel-subtle rounded-full border border-white/20 dark:border-white/10 shadow-sm px-4 h-10 transition-all duration-300 hover:bg-white/10 group',
                        className
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-indigo-500 transition-colors" />
                        <span className="corp-caption font-bold uppercase tracking-tight">
                            {currentLanguageInfo.code}
                        </span>
                        <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform duration-300", isOpen && "rotate-180")} />
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px] corp-card animate-in fade-in zoom-in duration-200">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={cn(
                            'gap-2 cursor-pointer py-2.5 px-4 focus:bg-indigo-50 dark:focus:bg-indigo-900/20 transition-colors',
                            isCurrentLanguage(lang.code) && 'bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 font-medium'
                        )}
                    >
                        <span className="text-base">{lang.flag}</span>
                        <span className="corp-body-sm">{lang.name}</span>
                        {isCurrentLanguage(lang.code) && (
                            <span className="ml-auto">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LanguageSelector;
