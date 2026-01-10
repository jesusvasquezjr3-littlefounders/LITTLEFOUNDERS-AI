import React from 'react';
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
            <button
                onClick={() => setTheme("system")}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'system'
                    ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400 scale-110'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                title="Sistema"
                aria-label="Tema del sistema"
            >
                <Monitor className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'light'
                    ? 'bg-white dark:bg-slate-600 shadow-sm text-amber-500 scale-110'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                title="Claro"
                aria-label="Tema claro"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'dark'
                    ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-500 scale-110'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                title="Oscuro"
                aria-label="Tema oscuro"
            >
                <Moon className="w-4 h-4" />
            </button>
        </div>
    );
}
