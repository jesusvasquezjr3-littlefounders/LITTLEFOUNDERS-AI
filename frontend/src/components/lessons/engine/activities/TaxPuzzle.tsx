import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

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

        const fallbackOptionState = (id: string): OptionState => {
            if (fb === 'none') return selectedOption === id ? 'selected' : 'idle';
            if (id === selectedOption) return fb === 'success' ? 'correct' : 'wrong';
            return 'dimmed';
        };

        return (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 text-center">
                    <div className="lp-chip inline-flex items-center gap-2 px-4 py-3" style={{ color: 'var(--lp-indigo-ink)' }}>
                        <Calculator className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                        <span className="lp-display text-sm">
                            {content.puzzle || content.instruction || t('tax_puzzle.title', { defaultValue: 'Puzzle Fiscal' })}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 mb-8">
                    {content.options.map((option: any, index: number) => (
                        <OptionCard
                            key={option.id}
                            index={index}
                            text={pickText(option)}
                            state={fallbackOptionState(option.id)}
                            onClick={() => handleSelect(option.id)}
                            disabled={fb !== 'none'}
                        />
                    ))}
                </div>
                {fb === 'none' ? (
                    <QuestButton variant="gold" disabled={!selectedOption} onClick={handleCheckFallback}>
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </QuestButton>
                ) : (
                    <QuestButton variant={fb === 'success' ? 'go' : 'retry'} onClick={handleContinueFallback}>
                        {fb === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                        {fb === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </QuestButton>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Title */}
            <div className="mb-6 text-center">
                <div className="lp-chip inline-flex items-center gap-2 px-4 py-3" style={{ color: 'var(--lp-indigo-ink)' }}>
                    <Calculator className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                    <span className="lp-display text-sm">
                        {content.puzzle || t('tax_puzzle.title', { defaultValue: 'Puzzle Fiscal' })}
                    </span>
                </div>
            </div>

            {/* Puzzle Pieces */}
            <div className="space-y-4 mb-8">
                {puzzlePieces.map((piece: any) => (
                    <div
                        key={piece.id}
                        className="lp-card p-4 sm:p-6"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{piece.icon || '🧩'}</span>
                                <label htmlFor={`piece-${piece.id}`} className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                                    {pickText(piece, ['name', 'label', 'text', 'title'])}
                                </label>
                            </div>
                            <span className="lp-display text-lg" style={{ color: 'var(--lp-indigo)' }}>
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
                            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: 'var(--lp-indigo)', background: 'var(--lp-bg-2)' }}
                        />
                        <p className="text-xs mt-2" style={{ color: 'var(--lp-muted)' }}>
                            {pickText(piece, ['description', 'detail', 'subtitle'])}
                        </p>
                    </div>
                ))}
            </div>

            {/* Calculation Flow */}
            <div className="mb-8 space-y-3">
                <div className="lp-card p-4 sm:p-6" style={{ borderColor: 'var(--lp-emerald)' }}>
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                            {t('tax_puzzle.gross_income')}
                        </span>
                        <span className="lp-display text-xl" style={{ color: 'var(--lp-emerald)' }}>
                            ${income.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="lp-display text-2xl" style={{ color: 'var(--lp-muted)' }}>−</div>
                </div>

                <div className="lp-card p-4 sm:p-6" style={{ borderColor: 'var(--lp-coral)' }}>
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                            {t('tax_puzzle.deductions')}
                        </span>
                        <span className="lp-display text-xl" style={{ color: 'var(--lp-coral)' }}>
                            ${deductions.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="lp-display text-2xl" style={{ color: 'var(--lp-muted)' }}>=</div>
                </div>

                <div className="lp-card p-4 sm:p-6" style={{ borderColor: 'var(--lp-indigo)' }}>
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                            {t('tax_puzzle.taxable_income')}
                        </span>
                        <span className="lp-display text-xl" style={{ color: 'var(--lp-indigo)' }}>
                            ${taxableIncome.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="lp-display text-2xl" style={{ color: 'var(--lp-muted)' }}>×</div>
                </div>

                <div className="lp-card p-4 sm:p-6" style={{ borderColor: 'var(--lp-amber)' }}>
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                            {t('tax_puzzle.tax_rate')}
                        </span>
                        <span className="lp-display text-xl" style={{ color: 'var(--lp-amber)' }}>
                            {taxRate}%
                        </span>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="lp-display text-2xl" style={{ color: 'var(--lp-muted)' }}>=</div>
                </div>

                <div className="lp-card p-6" style={{ borderWidth: '3px', borderColor: 'var(--lp-coral)' }}>
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                            {t('tax_puzzle.tax_owed')}
                        </span>
                        <span className="lp-display text-3xl" style={{ color: 'var(--lp-coral)' }}>
                            ${taxOwed.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            {feedback === 'none' ? (
                <QuestButton variant="gold" onClick={handleCheck}>
                    {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </QuestButton>
            )}
        </div>
    );
};
