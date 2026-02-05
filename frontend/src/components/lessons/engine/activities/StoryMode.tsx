import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
// Import other characters if needed, but maybe dynamic import or prop is better? 
// For now, hardcode or reuse LessonRunner logic if possible? 
// Actually, `StoryMode` might need to be passed the Character component or render it itself.
import DrRhoCharacter, { RhoMood } from '@/components/demo/DrRhoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/demo/ZaraVexCharacter';

interface StoryPage {
    id: string;
    text: string;
    image?: string;
    character_mood?: string;
    choices?: Array<{ id: string; text: string; next_page?: string }>; // Creating interactions
}

interface StoryModeProps {
    exercise: any;
    onNext: () => void;
}

export const StoryMode = ({ exercise, onNext }: StoryModeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    // State
    const [pageIndex, setPageIndex] = useState(0);
    const [history, setHistory] = useState<number[]>([0]); // Track path
    const [isAnimating, setIsAnimating] = useState(false);

    const pages: StoryPage[] = exercise.content.pages || [];
    const currentPage = pages[pageIndex] || pages[0];

    useEffect(() => {
        // Reset on new exercise
        setPageIndex(0);
        setHistory([0]);
    }, [exercise]);

    const handleChoice = (nextPageId?: string) => {
        playSound('ui_tap');
        setIsAnimating(true);
        setTimeout(() => {
            if (nextPageId) {
                const nextIdx = pages.findIndex(p => p.id === nextPageId);
                if (nextIdx !== -1) {
                    setPageIndex(nextIdx);
                    setHistory(prev => [...prev, nextIdx]);
                } else {
                    // Fallback to next index
                    handleNext();
                }
            } else {
                handleNext();
            }
            setIsAnimating(false);
        }, 300);
    };

    const handleNext = () => {
        if (pageIndex < pages.length - 1) {
            playSound('ui_tap');
            setIsAnimating(true);
            setTimeout(() => {
                setPageIndex(prev => {
                    const next = prev + 1;
                    setHistory(h => [...h, next]);
                    return next;
                });
                setIsAnimating(false);
            }, 300);
        } else {
            // End of story
            onNext();
        }
    };

    const handleBack = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const prevIndex = newHistory[newHistory.length - 1];
            setHistory(newHistory);
            setPageIndex(prevIndex);
        }
    };

    // Determine Character
    const characterCode = exercise.character_code || 'dr_rho';
    const mood = currentPage.character_mood || 'neutral';

    const renderCharacter = () => {
        const className = "w-[200px] sm:w-[280px] mx-auto filter drop-shadow-xl transition-all duration-500 hover:scale-105";

        // This duplication of logic from LessonRunner is acceptable for isolation
        if (characterCode === 'dina') return <DinaCharacter className={className} expression={mood as any} />;
        if (characterCode === 'dr_rho') return <DrRhoCharacter className={className} mood={mood as any} />;
        if (characterCode === 'zara_vex') return <ZaraVexCharacter className={className} mood={mood as any} />;
        return <DinoCharacter className={className} mood={mood as any} showBubble={false} />;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in relative px-4">
            {/* Story Book Container */}
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-4 border-amber-200 dark:border-amber-900 overflow-hidden flex flex-col md:flex-row min-h-[500px] relative">

                {/* Book Decoration */}
                <div className="absolute top-0 left-0 w-full h-4 bg-amber-300 dark:bg-amber-800 z-10" />

                {/* Visual Side (Left on Desktop, Top on Mobile) */}
                <div className="w-full md:w-1/2 bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 flex items-end justify-center p-6 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-multiply dark:mix-blend-screen" />

                    {/* Character */}
                    <div className={cn("relative z-10 transition-all duration-500 transform", isAnimating ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0")}>
                        {renderCharacter()}
                    </div>
                </div>

                {/* Text Side (Right on Desktop, Bottom on Mobile) */}
                <div className="w-full md:w-1/2 p-8 flex flex-col relative bg-paper-texture">
                    {/* Page Number */}
                    <div className="absolute top-6 right-8 text-muted-foreground font-mono text-xs border border-muted px-2 py-1 rounded-md">
                        PAGE {pageIndex + 1} / {pages.length}
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <BookOpen className="w-8 h-8 text-amber-500 mb-4 opacity-50" />

                        <div className={cn("transition-all duration-500 delay-100", isAnimating ? "opacity-0 translate-x-10" : "opacity-100 translate-x-0")}>
                            <p className="text-xl md:text-2xl font-medium leading-relaxed font-serif text-slate-800 dark:text-slate-200 mb-8">
                                "{currentPage.text}"
                            </p>


                            {/* Choices or Next Button */}
                            <div className="space-y-3">
                                {currentPage.choices && currentPage.choices.length > 0 ? (
                                    currentPage.choices.map((choice, idx) => (
                                        <Button
                                            key={choice.id}
                                            onClick={() => handleChoice(choice.next_page)}
                                            className={cn(
                                                "w-full h-auto py-4 text-left justify-start text-lg whitespace-normal rounded-xl border-2 transition-all",
                                                "bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-foreground border-amber-200 dark:border-slate-700",
                                                "shadow-sm hover:shadow-md hover:border-amber-400"
                                            )}
                                        >
                                            <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold text-sm flex-shrink-0">
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            {choice.text}
                                        </Button>
                                    ))
                                ) : (
                                    <div className="flex gap-4">
                                        {history.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                onClick={handleBack}
                                                className="text-muted-foreground"
                                            >
                                                {t('common:buttons.back')}
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleNext}
                                            className="flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-[0_4px_0_rgb(180,83,9)] hover:shadow-[0_2px_0_rgb(180,83,9)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                                        >
                                            {pageIndex === pages.length - 1 ? t('actions.finish') : t('actions.continue')} <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
