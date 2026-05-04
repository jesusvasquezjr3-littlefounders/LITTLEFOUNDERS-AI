import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface TaxPuzzleProps {
    exercise: any;
    onSubmit: (answer: Record<string, number> | string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TaxPuzzle = ({ exercise, onSubmit, onNext, onRetry }: TaxPuzzleProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [pieces, setPieces] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [fb, setFb] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        const initial: Record<string, number> = {};
        (exercise.content.pieces || []).forEach((piece: any) => {
            initial[piece.id] = piece.defaultValue || 0;
        });
        setPieces(initial);
        setFeedback('none');
        setSelectedOption(null);
        setFb('none');
    }, [exercise]);

    const content = exercise?.content || {};
    const puzzlePieces = content.pieces || [];
    const hasPieces = puzzlePieces.length > 0;
    const income = pieces.income || 0;
    const deductions = pieces.deductions || 0;
    const taxRate = pieces.taxRate || 0;

    const taxableIncome = Math.max(0, income - deductions);
    const taxOwed = (taxableIncome * taxRate) / 100;
    const netIncome = income - taxOwed;

    const handlePieceChange = (pieceId: string, value: number) => {
        playSound('ui_tap');
        setPieces(prev => ({
            ...prev,
            [pieceId]: value
        }));
    };

    const handleCheck = () => {
        const isCorrect = onSubmit(pieces);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            const initial: Record<string, number> = {};
            puzzlePieces.forEach((piece: any) => {
                initial[piece.id] = piece.defaultValue || 0;
            });
            setPieces(initial);
            setFeedback('none');
            onRetry();
        }
    };

    // Fallback: if no pieces but has options, render as multiple choice
    if (!hasPieces && Array.isArray(content.options) && content.options.length > 0) {
        const handleSelect = (id: string) => {
            if (fb !== 'none') return;
            playSound('ui_tap');
            setSelectedOption(id);
        };

        const handleCheckFallback = () => {
            if (!selectedOption) return;
            const isCorrect = onSubmit(selectedOption);
            setFb(isCorrect ? 'success' : 'error');
        };

        const handleContinueFallback = () => {
            if (fb === 'success') {
                onNext();
            } else {
                setSelectedOption(null);
                setFb('none');
                onRetry();
            }
        };

        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-950/30 border-2 border-purple-400 dark:border-purple-700 rounded-xl px-4 py-3">
                        <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-bold text-purple-800 dark:text-purple-200">
                            {content.puzzle || content.instruction || t('tax_puzzle.title', { defaultValue: 'Puzzle Fiscal' })}
                        </span>
                    </div>
                </div>
                <div className="space-y-3 mb-8">
                    {content.options.map((option: any) => (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            disabled={fb !== 'none'}
                            className={cn(
                                "w-full text-left p-4 rounded-xl border-2 transition-all",
                                selectedOption === option.id
                                    ? "bg-purple-100 dark:bg-purple-950 border-purple-500"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-purple-300"
                            )}
                        >
                            <span className="font-medium text-slate-800 dark:text-slate-100">{option.text}</span>
                        </button>
                    ))}
                </div>
                {fb === 'none' ? (
                    <Button onClick={handleCheckFallback} disabled={!selectedOption} className="w-full max-w-md mx-auto block h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] disabled:opacity-50">
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center">
                        <p className={cn("font-bold text-lg mb-3", fb === 'success' ? "text-green-500" : "text-orange-500")}>
                            {fb === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <Button onClick={handleContinueFallback} className={cn("w-full max-w-md h-12 text-base font-bold rounded-2xl", fb === 'success' ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600")}>
                            {fb === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Title */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-950/30 border-2 border-purple-400 dark:border-purple-700 rounded-xl px-4 py-3">
                    <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-bold text-purple-800 dark:text-purple-200">
                        {content.puzzle || t('tax_puzzle.title', { defaultValue: 'Puzzle Fiscal' })}
                    </span>
                </div>
            </div>

            {/* Puzzle Pieces */}
            <div className="space-y-4 mb-8">
                {puzzlePieces.map((piece: any) => (
                    <div
                        key={piece.id}
                        className="liquid-glass-strong rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-xl"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{piece.icon || '🧩'}</span>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {piece.name}
                                </label>
                            </div>
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {piece.id === 'taxRate' ? `${pieces[piece.id]}%` : `$${pieces[piece.id]?.toLocaleString()}`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={piece.min || 0}
                            max={piece.max || 100}
                            step={piece.step || 1}
                            value={pieces[piece.id] || 0}
                            onChange={(e) => handlePieceChange(piece.id, Number(e.target.value))}
                            disabled={feedback !== 'none'}
                            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {piece.description}
                        </p>
                    </div>
                ))}
            </div>

            {/* Calculation Flow */}
            <div className="mb-8 space-y-3">
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border-2 border-green-400 dark:border-green-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-800 dark:text-green-200">
                            {t('tax_puzzle.gross_income')}
                        </span>
                        <span className="text-xl font-black text-green-900 dark:text-green-100">
                            ${income.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl text-slate-400">−</div>
                </div>

                <div className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-950/30 dark:to-amber-950/30 rounded-xl p-4 border-2 border-orange-400 dark:border-orange-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-orange-800 dark:text-orange-200">
                            {t('tax_puzzle.deductions')}
                        </span>
                        <span className="text-xl font-black text-orange-900 dark:text-orange-100">
                            ${deductions.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl text-slate-400">=</div>
                </div>

                <div className="bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-4 border-2 border-blue-400 dark:border-blue-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            {t('tax_puzzle.taxable_income')}
                        </span>
                        <span className="text-xl font-black text-blue-900 dark:text-blue-100">
                            ${taxableIncome.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl text-slate-400">×</div>
                </div>

                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl p-4 border-2 border-purple-400 dark:border-purple-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-purple-800 dark:text-purple-200">
                            {t('tax_puzzle.tax_rate')}
                        </span>
                        <span className="text-xl font-black text-purple-900 dark:text-purple-100">
                            {taxRate}%
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl text-slate-400">=</div>
                </div>

                <div className="bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-950/30 dark:to-rose-950/30 rounded-xl p-6 border-4 border-red-500 dark:border-red-700">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-red-800 dark:text-red-200">
                            {t('tax_puzzle.tax_owed')}
                        </span>
                        <span className="text-3xl font-black text-red-900 dark:text-red-100">
                            ${taxOwed.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleCheck}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">{t('actions.verify')}</span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                            {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "relative overflow-hidden w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
