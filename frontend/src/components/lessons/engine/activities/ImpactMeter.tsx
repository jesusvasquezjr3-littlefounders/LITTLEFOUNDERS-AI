import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface ImpactMeterProps {
    exercise: any;
    onSubmit: (causeId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ImpactMeter = ({ exercise, onSubmit, onNext, onRetry }: ImpactMeterProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedCause, setSelectedCause] = useState<string | null>(null);
    const [showImpact, setShowImpact] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSelectedCause(null);
        setShowImpact(false);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const causes = exercise.content.causes || [];
    const budget = exercise.content.budget || 100;

    const handleSelectCause = (causeId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelectedCause(causeId);
    };

    const handleDonate = () => {
        if (!selectedCause) return;

        setShowImpact(true);

        timeoutRef.current = setTimeout(() => {
            const isCorrect = onSubmit(selectedCause);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedCause(null);
            setShowImpact(false);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Budget Display */}
            <div className="mb-8 text-center">
                <div className="inline-flex flex-col items-center bg-pink-500 border-2 border-pink-600 text-white rounded-3xl px-8 py-6 shadow-sm">
                    <span className="text-sm font-medium opacity-90 mb-1">{t('impact_meter.your_donation')}</span>
                    <div className="text-5xl font-black">${budget}</div>
                </div>
            </div>

            {/* Causes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {causes.map((cause: any) => {
                    const isSelected = selectedCause === cause.id;

                    return (
                        <button
                            key={cause.id}
                            onClick={() => handleSelectCause(cause.id)}
                            disabled={feedback !== 'none'}
                            aria-pressed={isSelected}
                            aria-label={cause.name}
                            className={cn(
                                "relative p-4 rounded-2xl border-2 transition-all duration-300 transform",
                                "bg-white dark:bg-slate-800",
                                isSelected && feedback === 'none' && "ring-4 ring-pink-400 dark:ring-pink-600 scale-105 shadow-sm",
                                !isSelected && feedback === 'none' && "border-slate-200 dark:border-slate-700 hover:border-pink-300 dark:hover:border-pink-700 hover:shadow-lg hover:-translate-y-1",
                                feedback === 'success' && isSelected && "border-green-500 ring-4 ring-green-300 scale-105",
                                feedback !== 'none' && !isSelected && "opacity-50"
                            )}
                        >
                            <div className="text-center">
                                <div className="text-4xl sm:text-5xl mb-2">{cause.icon}</div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                                    {cause.name}
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                                    {cause.impact}
                                </p>
                            </div>

                            {/* Selection Heart */}
                            {isSelected && feedback === 'none' && (
                                <div className="absolute -top-3 -right-3 w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center animate-in zoom-in shadow-lg">
                                    <Heart className="w-5 h-5 text-white fill-white" />
                                </div>
                            )}

                            {/* Impact Animation */}
                            {showImpact && isSelected && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                        {[...Array(6)].map((_, i) => (
                                            <Heart
                                                key={i}
                                                className="absolute w-6 h-6 text-pink-500 fill-pink-500 animate-float-away"
                                                style={{
                                                    animationDelay: `${i * 0.1}s`,
                                                    transform: `rotate(${i * 60}deg) translateY(-${i * 20}px)`
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleDonate}
                        disabled={!selectedCause}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-pink-500 hover:bg-pink-600 text-white rounded-2xl shadow-[0_4px_0_rgb(190,24,93)] hover:shadow-[0_2px_0_rgb(190,24,93)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        <Heart className="w-5 h-5 fill-white" />
                        {t('impact_meter.donate')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success' ? (
                                <>
                                    <Sparkles className="w-5 h-5 inline-block mr-1" />
                                    {t('impact_meter.thank_you')}
                                </>
                            ) : (
                                t('feedback.error')
                            )}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        >
                            {t('actions.continue')}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
