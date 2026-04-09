import React from 'react';
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const options = [
        { id: 'system', icon: Monitor, label: 'Sistema', color: 'text-blue-500' },
        { id: 'light', icon: Sun, label: 'Claro', color: 'text-amber-500' },
        { id: 'dark', icon: Moon, label: 'Oscuro', color: 'text-indigo-500' },
    ];

    const activeIndex = options.findIndex(opt => opt.id === theme);

    return (
        <div className="relative flex items-center p-1 liquid-glass-subtle rounded-full border border-white/20 dark:border-white/10 shadow-sm h-10 group">
            {/* Sliding Indicator */}
            <div 
                className="absolute h-[calc(100%-8px)] w-[calc(33.33%-4px)] bg-white dark:bg-white/20 rounded-full shadow-sm transition-all duration-300 ease-in-out z-0"
                style={{ 
                    left: '4px',
                    transform: `translateX(${activeIndex * 100}%)` 
                }}
            />

            {options.map((opt) => {
                const Icon = opt.icon;
                const isActive = theme === opt.id;
                
                return (
                    <button
                        key={opt.id}
                        onClick={() => setTheme(opt.id as any)}
                        className={cn(
                            "relative z-10 w-9 h-full rounded-full transition-all duration-300 flex items-center justify-center",
                            isActive 
                                ? cn("scale-110", opt.color) 
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                        title={opt.label}
                        aria-label={opt.label}
                    >
                        <Icon className={cn("w-3.5 h-3.5", isActive && "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]")} />
                    </button>
                );
            })}
        </div>
    );
}

export default ThemeToggle;
