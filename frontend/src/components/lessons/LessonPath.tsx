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

            <div className="relative w-full flex flex-col items-center space-y-12">
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
                                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1 h-24 -z-10">
                                        {/* SVG Curve logic could be complex, for now using a straight dashed line that mimics the flow or just absolute div bars. 
                                         For zig-zag, vertical lines look weird. We need diagonal. 
                                         Let's keep it simple: No visible line for V1 or a simple dotted path effectively.
                                     */}
                                        {/* We will rely on the layout finding the flow. A real SVG path is best but complex to calculate dynamically without fixed heights. */}
                                    </div>
                                )}

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => onModuleClick(module)}
                                                disabled={module.locked}
                                                className={cn(
                                                    "relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center border-b-8 transition-all active:border-b-0 active:translate-y-2 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-primary/50",
                                                    module.completed
                                                        ? "bg-gradient-to-b from-yellow-400 to-yellow-500 border-yellow-600 text-yellow-900 hover:brightness-110"
                                                        : module.locked
                                                            ? "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                                                            : "bg-gradient-to-b from-indigo-500 to-indigo-600 border-indigo-800 text-white ring-4 ring-indigo-200 hover:ring-indigo-300 animate-[bounce_2s_infinite]"
                                                )}
                                            >
                                                {/* Inner Icon */}
                                                <div className="relative z-10 w-full h-full flex items-center justify-center">
                                                    {module.locked ? (
                                                        <Lock className="w-8 h-8 md:w-10 md:h-10 opacity-50" />
                                                    ) : module.completed ? (
                                                        <Check className="w-10 h-10 md:w-12 md:h-12 drop-shadow-sm" strokeWidth={4} />
                                                    ) : (
                                                        <div className="relative">
                                                            <Play className="w-10 h-10 md:w-12 md:h-12 fill-current ml-1" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stars for completed */}
                                                {module.completed && (
                                                    <div className="absolute -top-2 -right-2 z-20">
                                                        <div className="bg-orange-400 p-2 rounded-full border-4 border-white shadow-sm flex items-center justify-center">
                                                            <Star className="w-4 h-4 text-white fill-white" />
                                                        </div>
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

                                {/* Floating Title (Fixed: No truncation, full wrapping) */}
                                <div className="mt-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border shadow-sm text-sm font-bold text-gray-800 w-max max-w-[180px] md:max-w-[260px] text-center leading-tight whitespace-normal break-words z-20">
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
