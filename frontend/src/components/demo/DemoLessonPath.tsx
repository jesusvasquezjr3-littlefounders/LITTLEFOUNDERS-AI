import React from "react";
import { Check, Lock, LucideIcon } from "lucide-react";

interface DemoModule {
    id: string;
    title: string;
    description: string;
    duration: string;
    difficulty: "Fácil" | "Intermedio" | "Avanzado";
    progress: number;
    completed: boolean;
    locked: boolean;
    icon: LucideIcon;
    activities?: string[];
}

interface DemoLessonPathProps {
    modules: DemoModule[];
    onModuleClick: (module: DemoModule) => void;
}

export const DemoLessonPath: React.FC<DemoLessonPathProps> = ({ modules, onModuleClick }) => {
    // Color schemes for variety
    const colors = [
        { bg: "bg-green-500", border: "border-green-600", glow: "shadow-green-500/30" },
        { bg: "bg-blue-500", border: "border-blue-600", glow: "shadow-blue-500/30" },
        { bg: "bg-purple-500", border: "border-purple-600", glow: "shadow-purple-500/30" },
        { bg: "bg-orange-500", border: "border-orange-600", glow: "shadow-orange-500/30" },
        { bg: "bg-pink-500", border: "border-pink-600", glow: "shadow-pink-500/30" },
    ];

    return (
        <div className="relative w-full max-w-md mx-auto py-8">
            {/* Connecting Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gray-200 dark:bg-gray-700 -translate-x-1/2 z-0" />

            <div className="relative z-10 flex flex-col items-center gap-8">
                {modules.map((module, index) => {
                    const colorScheme = colors[index % colors.length];
                    const Icon = module.icon;
                    const isActive = !module.locked && !module.completed;

                    // Serpentine positioning
                    const positions = ["translate-x-0", "-translate-x-16", "translate-x-0", "translate-x-16"];
                    const position = positions[index % 4];

                    return (
                        <div
                            key={module.id}
                            className={`transform ${position} transition-all duration-300`}
                        >
                            {/* Node */}
                            <button
                                onClick={() => onModuleClick(module)}
                                disabled={module.locked}
                                className={`
                  relative w-24 h-24 rounded-full flex items-center justify-center
                  border-b-[6px] transition-all duration-200
                  ${module.locked
                                        ? "bg-gray-400 border-gray-500 opacity-50 cursor-not-allowed"
                                        : `${colorScheme.bg} ${colorScheme.border} hover:scale-110 cursor-pointer shadow-lg ${colorScheme.glow}`
                                    }
                  ${isActive ? "ring-4 ring-white ring-opacity-50 animate-pulse" : ""}
                  active:border-b-0 active:translate-y-[6px]
                `}
                            >
                                {/* Gloss effect */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 bg-white/20 rounded-t-full pointer-events-none" />

                                {/* Icon */}
                                {module.completed ? (
                                    <Check className="w-10 h-10 text-white" strokeWidth={4} />
                                ) : module.locked ? (
                                    <Lock className="w-8 h-8 text-white" />
                                ) : (
                                    <Icon className="w-10 h-10 text-white" />
                                )}

                                {/* START badge for active */}
                                {isActive && !module.completed && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 animate-bounce z-20">
                                        <span className="px-2 py-0.5 text-[10px] font-black bg-white text-purple-600 rounded-full shadow-lg border-2 border-purple-500">
                                            START
                                        </span>
                                    </div>
                                )}
                            </button>

                            {/* Label */}
                            <div className={`
                mt-3 text-center max-w-[140px] px-3 py-2 rounded-xl
                bg-white dark:bg-slate-800 shadow-md
                ${module.locked ? "opacity-50" : ""}
              `}>
                                <p className="text-sm font-bold text-gray-800 dark:text-white leading-tight">
                                    {module.title}
                                </p>
                                {module.completed && (
                                    <span className="text-xs text-green-600 font-semibold">✓ Completado</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DemoLessonPath;
