import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PopOptionButtonProps {
    id: string;
    text: React.ReactNode;
    colorTheme?: 'purple' | 'pink' | 'blue' | 'orange' | 'green' | 'amber';
    isSelected: boolean;
    isCorrect?: boolean;
    showResult: boolean;
    feedback: 'none' | 'success' | 'error';
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}

export const PopOptionButton: React.FC<PopOptionButtonProps> = ({
    text,
    colorTheme = 'purple',
    isSelected,
    isCorrect,
    showResult,
    feedback,
    onClick,
    disabled = false,
    className
}) => {
    // Map theme to Tailwind utilities
    const themeStyles = {
        purple: {
            bg: 'bg-purple-500',
            hover: 'hover:bg-purple-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        },
        pink: {
            bg: 'bg-pink-500',
            hover: 'hover:bg-pink-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(190,24,93)] hover:shadow-[0_2px_0_rgb(190,24,93)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        },
        blue: {
            bg: 'bg-blue-500',
            hover: 'hover:bg-blue-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        },
        orange: {
            bg: 'bg-orange-500',
            hover: 'hover:bg-orange-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        },
        green: {
            bg: 'bg-green-500',
            hover: 'hover:bg-green-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        },
        amber: {
            bg: 'bg-amber-500',
            hover: 'hover:bg-amber-600',
            text: 'text-white',
            shadow: 'shadow-[0_4px_0_rgb(180,83,9)] hover:shadow-[0_2px_0_rgb(180,83,9)]',
            active: 'active:shadow-none active:translate-y-[4px]'
        }
    };

    const color = themeStyles[colorTheme] || themeStyles.purple;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full p-3 sm:p-4 rounded-[20px] text-left transition-all duration-200 transform relative overflow-hidden flex flex-col justify-center min-h-[60px] sm:min-h-[72px]",
                "font-bold text-sm sm:text-base leading-tight",
                color.text,

                // Default state
                !showResult && !isSelected && `${color.bg} ${color.hover} ${color.shadow} ${color.active} hover:-translate-y-[2px]`,

                // Selected state (Before verification)
                !showResult && isSelected && `${color.bg} shadow-none translate-y-[4px] ring-4 ring-white/30`,

                // Success
                showResult && feedback === 'success' && isSelected && isCorrect && "bg-green-500 shadow-none ring-4 ring-green-300 scale-100 z-10",
                showResult && feedback === 'success' && !isSelected && "opacity-20 grayscale",

                // Error
                showResult && feedback === 'error' && isSelected && "bg-red-500 shadow-none ring-4 ring-red-300",
                showResult && feedback === 'error' && !isSelected && "opacity-50",
                
                className
            )}
        >
            <div className="flex items-center justify-between gap-3 w-full z-10 relative">
                <span className="flex-1">
                    {text}
                </span>

                {showResult && feedback === 'success' && isSelected && isCorrect && (
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-sm animate-in zoom-in shrink-0">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 stroke-[3px]" />
                    </div>
                )}
                {showResult && feedback === 'error' && isSelected && (
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-sm animate-in zoom-in shrink-0">
                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 stroke-[3px]" />
                    </div>
                )}
            </div>

            <div className="absolute bottom-0 left-0 w-full h-px bg-black/10 pointer-events-none" />
        </button>
    );
};
