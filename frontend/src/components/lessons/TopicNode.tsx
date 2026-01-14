import React from 'react';
import { Check, Lock, Star } from 'lucide-react';

// ============== TYPES ==============

export interface Topic {
    id: number;
    title: string;
    description: string;
    isCompleted: boolean;
    isLocked: boolean;
    type: 'lesson' | 'quiz' | 'milestone'; // Added type for variety
}

// ============== THEME COLORS ==============

const THEME_COLORS = {
    amber: { base: "bg-amber-500", border: "border-amber-600", shadow: "shadow-amber-900/20" },
    purple: { base: "bg-purple-500", border: "border-purple-600", shadow: "shadow-purple-900/20" },
    emerald: { base: "bg-emerald-500", border: "border-emerald-600", shadow: "shadow-emerald-900/20" },
    blue: { base: "bg-blue-500", border: "border-blue-600", shadow: "shadow-blue-900/20" },
    rose: { base: "bg-rose-500", border: "border-rose-600", shadow: "shadow-rose-900/20" },
    slate: { base: "bg-slate-500", border: "border-slate-600", shadow: "shadow-slate-900/20" },
};

// ============== COMPONENT ==============

interface TopicNodeProps {
    topic: Topic;
    index: number;
    totalInSaga: number;
    x: number;
    y: number;
    colorTheme: keyof typeof THEME_COLORS;
    onClick?: () => void;
}

export const TopicNode: React.FC<TopicNodeProps> = ({ topic, index, totalInSaga, x, y, colorTheme, onClick }) => {
    const colors = topic.isLocked ? THEME_COLORS.slate : THEME_COLORS[colorTheme];
    const isStart = !topic.isLocked && !topic.isCompleted && (index === 0 || index > 0); // Logic can be refined for "current"

    return (
        <div
            className="absolute flex flex-col items-center justify-center w-24 h-24 z-10"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
        >
            {/* Tooltip Title (Always visible for unlocked, or on hover) */}
            <div className={`
        absolute -top-12 px-3 py-1.5 rounded-xl text-center whitespace-nowrap z-20 transition-all duration-300
        bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 shadow-xl
        ${topic.isLocked ? 'opacity-0 hover:opacity-100' : 'opacity-100'}
      `}>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {topic.title}
                </span>
                {/* Triangle pointer */}
                <div className="absolute top-full left-1/2 -ml-2 border-8 border-transparent border-t-white dark:border-t-slate-800" />
            </div>

            {/* Button Node */}
            <button
                onClick={onClick}
                disabled={topic.isLocked}
                className={`
          group relative w-[70px] h-[60px] rounded-[30px] flex items-center justify-center
          transition-all duration-150 active:scale-95 outline-none
          ${colors.base}
          border-b-[6px] ${colors.border} active:border-b-0 active:translate-y-[6px]
          ${topic.isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:brightness-110'}
          shadow-xl
        `}
            >
                {/* Shine effect */}
                <div className="absolute top-1 left-2 w-8 h-3 bg-white/30 rounded-full" />

                {/* Icon */}
                <div className="text-white drop-shadow-md">
                    {topic.isCompleted ? (
                        <Check strokeWidth={4} size={28} />
                    ) : topic.isLocked ? (
                        <Lock size={24} />
                    ) : (
                        <Star fill="currentColor" size={28} />
                    )}
                </div>

                {/* Current Indicator Ring */}
                {!topic.isLocked && !topic.isCompleted && (
                    <div className="absolute inset-0 -m-1.5 border-4 border-yellow-400 rounded-[34px] animate-pulse pointer-events-none" />
                )}
            </button>
        </div>
    );
};
