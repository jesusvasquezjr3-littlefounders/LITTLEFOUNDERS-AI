import React from 'react';
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    // Determine if effectively dark (for system preference handling, we might need more logic or just toggle explicit states)
    // For this simple toggle, let's switch between 'light' and 'dark'.
    const isDark = theme === 'dark';

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            onClick={toggleTheme}
            className={`relative flex items-center w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isDark ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
            aria-label="Cambiar tema"
        >
            <div
                className={`absolute w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-8' : 'translate-x-0'
                    }`}
            >
                {isDark ? (
                    <Moon className="w-4 h-4 text-indigo-600" />
                ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                )}
            </div>
        </button>
    );
}
