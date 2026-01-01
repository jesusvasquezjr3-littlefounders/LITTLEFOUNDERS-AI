import React from 'react';
import { Check, Lock, Star, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface Module {
    id: string;
    title: string;
    description: string;
    duration: string;
    difficulty: "Fácil" | "Intermedio" | "Avanzado";
    progress: number;
    completed: boolean;
    locked: boolean;
    icon: any;
    activities: string[];
}

interface LessonPathProps {
    modules: Module[];
    onModuleClick: (module: Module) => void;
}

export const LessonPath: React.FC<LessonPathProps> = ({ modules, onModuleClick }) => {
    return (
        <div className="flex flex-col items-center py-10 relative min-h-[500px] max-w-2xl mx-auto">
            {/* Background Decor can go here if needed */}

            <div className="relative w-full flex flex-col items-center space-y-8 md:space-y-12">
                {modules.map((module, index) => {
                    // Calculate alignment for zig-zag effect
                    // 0: center, 1: left, 2: center, 3: right, 4: center...
                    // Or simple zig-zag: left, right, left, right

                    // Let's do a sine wave style: Center -> Left -> Center -> Right -> Center
                    const positionCycle = index % 4;
                    let alignment = 'justify-center'; // Default center
                    let translateX = 'translate-x-0';

                    if (positionCycle === 1) translateX = '-translate-x-12 md:-translate-x-24'; // Left
                    if (positionCycle === 3) translateX = 'translate-x-12 md:translate-x-24'; // Right

                    const isLast = index === modules.length - 1;
                    const isNext = !module.completed && !module.locked;

                    return (
                        <div key={module.id} className={cn("relative z-10 flex w-full", alignment)}>

                            <div className={cn("relative flex flex-col items-center transition-transform", translateX)}>

                                {/* Connector Line to next node */}
                                {!isLast && (
                                    <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-2 h-16 md:h-20 -z-10 opacity-60">
                                        <div className={cn("w-full h-full rounded-full",
                                            module.completed ? "bg-yellow-400" : "bg-slate-200"
                                        )} />
                                    </div>
                                )}

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => onModuleClick(module)}
                                                disabled={module.locked}
                                                className={cn(
                                                    "relative w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center border-b-8 transition-all focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-primary/50",
                                                    // State Styles
                                                    module.completed
                                                        ? "bg-yellow-400 border-yellow-600 active:border-b-0 active:translate-y-2 hover:bg-yellow-300 dark:bg-yellow-500 dark:border-yellow-700"
                                                        : module.locked
                                                            ? "bg-slate-200 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600 cursor-not-allowed grayscale"
                                                            : "bg-indigo-500 border-indigo-700 text-white active:border-b-0 active:translate-y-2 hover:bg-indigo-400 dark:bg-indigo-600 dark:border-indigo-800 animate-pulse",
                                                    // Current Lesson Extra Pop
                                                    !module.completed && !module.locked && "ring-4 ring-indigo-200 scale-110 shadow-lg"
                                                )}
                                            >
                                                {/* Inner Icon */}
                                                <div className="relative z-10 w-full h-full flex items-center justify-center">
                                                    {module.locked ? (
                                                        <Lock className="w-8 h-8 md:w-10 md:h-10 opacity-40 text-slate-500" />
                                                    ) : module.completed ? (
                                                        <Check className="w-10 h-10 md:w-12 md:h-12 text-yellow-900 drop-shadow-sm" strokeWidth={4} />
                                                    ) : (
                                                        <div className="relative animate-[bounce_1s_infinite]">
                                                            <Star className="w-10 h-10 md:w-12 md:h-12 fill-current text-white" />
                                                        </div>
                                                    )}
                                                </div>


                                                {/* Start Label for Current */}
                                                {!module.completed && !module.locked && (
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md animate-bounce border border-indigo-100 dark:border-indigo-900">
                                                        ¡Empezar!
                                                    </div>
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] text-center p-3">
                                            <p className="font-bold text-base mb-1">{module.title}</p>
                                            <p className="text-xs text-muted-foreground">{module.description}</p>
                                            {module.locked && (
                                                <p className="text-xs text-red-400 mt-2 font-medium">Completa la lección anterior para desbloquear</p>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {/* Title Label underneath */}
                                <div className={cn(
                                    "mt-3 px-4 py-2 rounded-xl text-sm font-bold text-center leading-tight whitespace-normal break-words z-20 shadow-sm border transaction-colors duration-200",
                                    module.completed ? "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100 dark:border-yellow-800" :
                                        module.locked ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" :
                                            "bg-indigo-50 text-indigo-800 border-indigo-200 scale-105 dark:bg-indigo-900/40 dark:text-indigo-100 dark:border-indigo-800"
                                )}>
                                    {module.title}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Footer Message */}

            </div>
        </div>
    );
};
