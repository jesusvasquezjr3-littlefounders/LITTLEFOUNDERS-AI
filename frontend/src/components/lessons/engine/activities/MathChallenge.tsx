import { useState, useEffect } from 'react';
import { ArrowRight, Delete, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';
import { pickText } from './fieldText';

interface MathChallengeProps {
    exercise: any;
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MathChallenge = ({ exercise, onSubmit, onNext, onRetry }: MathChallengeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Some math_challenge exercises are actually multiple-choice (content.choices/options
    // with correctOptionId) — the numeric keypad cannot represent those, so render options.
    const content = exercise?.content || {};
    const options = resolveOptions(content, ['options', 'choices']);
    const isOptionMode = options.length > 0;

    // Others expect a non-numeric answer ("sí", "Subió", "5, 3, 2") the keypad can't type
    // → render a free-text input instead.
    const ca = exercise?.correct_answer || {};
    const textCandidate = ca.value ?? ca.answer ?? ca.solution ?? ca.text ?? ca.result ?? ca.correctText ?? ca.calculatedResult;
    const isTextMode = !isOptionMode && typeof textCandidate === 'string' && /[a-zA-Z,;]/.test(textCandidate);

    useEffect(() => {
        setInput('');
        setFeedback('none');
    }, [exercise]);

    const handleKeyPress = (key: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        if (input.length < 10) { // Limit length
            setInput(prev => prev + key);
        }
    };

    const handleDelete = () => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setInput(prev => prev.slice(0, -1));
    };

    const handleCheck = () => {
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(input);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setInput('');
            setFeedback('none');
            onRetry();
        }
    };

    if (isOptionMode) {
        const correctId = exercise.correct_answer?.correctOptionId;
        const optState = (id: string): OptionState => {
            if (feedback === 'none') return input === id ? 'selected' : 'idle';
            if (correctId != null && String(id) === String(correctId)) return 'correct';
            if (id === input) return 'wrong';
            return 'dimmed';
        };
        return (
            <div className="w-full max-w-2xl animate-slide-in-bottom">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {options.map((opt: any, index: number) => (
                        <OptionCard
                            key={opt.id}
                            index={index}
                            text={pickText(opt)}
                            state={optState(opt.id)}
                            onClick={() => { if (feedback === 'none') { setInput(opt.id); playSound('ui_tap'); } }}
                            disabled={feedback !== 'none'}
                        />
                    ))}
                </div>
                {feedback === 'none' ? (
                    <QuestButton variant="gold" disabled={!input} onClick={handleCheck}>
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
    }

    if (isTextMode) {
        return (
            <div className="w-full max-w-sm animate-slide-in-bottom flex flex-col items-center">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => { if (feedback === 'none') setInput(e.target.value); }}
                    disabled={feedback !== 'none'}
                    placeholder={t('fill_blank.placeholder', { defaultValue: 'Escribe tu respuesta...' })}
                    className="lp-display w-full px-4 py-3 mb-6 rounded-[var(--lp-radius-sm)] border-2 text-lg text-center focus:outline-none transition-colors disabled:opacity-50 focus:border-[var(--lp-indigo)]"
                    style={{ background: 'var(--lp-surface)', borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}
                />
                {feedback === 'none' ? (
                    <QuestButton variant="gold" disabled={input.trim().length === 0} onClick={handleCheck}>
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
    }

    return (
        <div className="w-full max-w-sm animate-slide-in-bottom flex flex-col items-center">

            {/* Display / Question */}
            <div className="lp-card p-6 w-full mb-6 text-center">
                <h3 className="lp-display text-sm sm:text-base mb-2 uppercase tracking-[0.18em]" style={{ color: "var(--lp-muted)" }}>
                    {t('actions.calculate')}
                </h3>
                <div className="lp-display text-4xl sm:text-5xl tracking-wider h-16 flex items-center justify-center" style={{ color: "var(--lp-ink)" }}>
                    {input || <span className="animate-pulse" style={{ color: "var(--lp-muted)", opacity: 0.5 }}>?</span>}
                </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleKeyPress(num.toString())}
                        disabled={feedback !== 'none'}
                        className="lp-token lp-display h-16 text-2xl flex items-center justify-center disabled:opacity-50"
                        style={{ color: "var(--lp-ink)" }}
                    >
                        {num}
                    </button>
                ))}

                {/* 0 and Controls */}
                <button
                    onClick={() => handleKeyPress('.')}
                    disabled={feedback !== 'none'}
                    className="lp-token lp-display h-16 text-2xl flex items-center justify-center disabled:opacity-50"
                    style={{ color: "var(--lp-muted)" }}
                >
                    .
                </button>
                <button
                    onClick={() => handleKeyPress('0')}
                    disabled={feedback !== 'none'}
                    className="lp-token lp-display h-16 text-2xl flex items-center justify-center disabled:opacity-50"
                    style={{ color: "var(--lp-ink)" }}
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    disabled={feedback !== 'none'}
                    className="lp-token lp-option lp-option--coral h-16 flex items-center justify-center disabled:opacity-50"
                    style={{ color: "var(--lp-coral-ink)" }}
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            {/* Action Button */}
            {feedback === 'none' ? (
                <QuestButton variant="gold" disabled={input.length === 0} onClick={handleCheck}>
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
