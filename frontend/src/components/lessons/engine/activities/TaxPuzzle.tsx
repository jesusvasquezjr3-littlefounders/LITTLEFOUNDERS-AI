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
                    <Button onClick={handleCheckFallback} disabled={!selectedOption} className="w-full max-w-md mx-auto h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] flex items-center justify-center gap-2">
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center">
                        <Button onClick={handleContinueFallback} className={cn("w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2", fb === 'success' ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(34,197,94)] hover:shadow-[0_2px_0_rgb(34,197,94)] active:shadow-none active:translate-y-[4px] hover:-translate-y-[2px]" : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(249,115,22)] hover:shadow-[0_2px_0_rgb(249,115,22)] active:shadow-none active:translate-y-[4px] hover:-translate-y-[2px]")}>
                            {fb === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
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
                        className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{piece.icon || '🧩'}</span>
                                <label htmlFor={`piece-${piece.id}`} className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {piece.name}
                                </label>
                            </div>
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {piece.id === 'taxRate' ? `${pieces[piece.id]}%` : `$${pieces[piece.id]?.toLocaleString()}`}
                            </span>
                        </div>
                        <input
                            id={`piece-${piece.id}`}
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
                <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-green-400 dark:border-green-600 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                            {t('tax_puzzle.gross_income')}
                        </span>
                        <span className="text-xl font-black text-green-600 dark:text-green-400">
                            ${income.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl font-black text-muted-foreground">−</div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-orange-400 dark:border-orange-600 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                            {t('tax_puzzle.deductions')}
                        </span>
                        <span className="text-xl font-black text-orange-600 dark:text-orange-400">
                            ${deductions.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl font-black text-muted-foreground">=</div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-blue-400 dark:border-blue-600 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                            {t('tax_puzzle.taxable_income')}
                        </span>
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                            ${taxableIncome.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl font-black text-muted-foreground">×</div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-purple-400 dark:border-purple-600 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                            {t('tax_puzzle.tax_rate')}
                        </span>
                        <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                            {taxRate}%
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="text-2xl font-black text-muted-foreground">=</div>
                </div>

                <div className="bg-card rounded-2xl p-6 border-4 border-red-500 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">
                            {t('tax_puzzle.tax_owed')}
                        </span>
                        <span className="text-3xl font-black text-red-500">
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
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                    >
                        {t('actions.verify')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(34,197,94)] hover:shadow-[0_2px_0_rgb(34,197,94)] active:shadow-none active:translate-y-[4px]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(249,115,22)] hover:shadow-[0_2px_0_rgb(249,115,22)] active:shadow-none active:translate-y-[4px]",
                                "hover:-translate-y-[2px]"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
