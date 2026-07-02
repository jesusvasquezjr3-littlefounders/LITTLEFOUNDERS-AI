import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { QuestButton } from '../ui/QuestButton';

interface BalanceScaleProps {
    exercise: any;
    onSubmit: (condition: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

type Condition = 'left_heavy' | 'right_heavy' | 'balanced';

export const BalanceScale = ({ exercise, onSubmit, onNext, onRetry }: BalanceScaleProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const content = exercise?.content || {};
    const left = content.left || { label: 'Izquierda', value: 0 };
    const right = content.right || { label: 'Derecha', value: 0 };

    const [userCondition, setUserCondition] = useState<Condition | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setUserCondition(null);
        setFeedback('none');
    }, [exercise]);

    const options: { id: Condition; label: string }[] = [
        { id: 'left_heavy', label: t('balance_scale.left_heavy', { defaultValue: 'La izquierda vale más' }) },
        { id: 'balanced', label: t('balance_scale.balanced', { defaultValue: 'Tienen el mismo valor' }) },
        { id: 'right_heavy', label: t('balance_scale.right_heavy', { defaultValue: 'La derecha vale más' }) },
    ];

    const handleSelect = (id: Condition) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setUserCondition(id);
    };

    const handleCheck = () => {
        if (!userCondition) {
            playSound('edu_error');
            return;
        }
        const isCorrect = onSubmit(userCondition);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') onNext();
        else {
            setUserCondition(null);
            setFeedback('none');
            onRetry();
        }
    };

    // Visual tilt based on values
    const leftVal = Number(left.value || 0);
    const rightVal = Number(right.value || 0);
    const tilt = leftVal > rightVal ? -1 : leftVal < rightVal ? 1 : 0;

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scenario */}
            <div className="mb-6 p-4 rounded-full" style={{ background: 'var(--lp-indigo-soft)', border: '1.5px solid var(--lp-indigo)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                    {content.scenario || t('balance_scale.scenario', { defaultValue: 'Compara el valor de estas dos opciones financieras.' })}
                </p>
            </div>

            {/* Scale visualization */}
            <div className="mb-6 flex flex-col items-center">
                <div className="relative w-full max-w-sm h-32">
                    {/* Beam */}
                    <div
                        className="absolute top-1/2 left-0 right-0 h-3 rounded-full mx-8 transition-transform duration-700"
                        style={{
                            background: 'var(--lp-ink)',
                            transform: `translateY(-50%) rotate(${tilt * 12}deg)`,
                            transformOrigin: 'center center',
                        }}
                    />
                    {/* Fulcrum */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0"
                        style={{
                            borderLeft: '16px solid transparent',
                            borderRight: '16px solid transparent',
                            borderTop: '20px solid var(--lp-muted)',
                        }}
                    />
                    {/* Left pan */}
                    <div
                        className="absolute top-0 left-4 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-700"
                        style={{
                            background: 'var(--lp-indigo-soft)',
                            border: '3px solid var(--lp-indigo)',
                            transform: `translateY(${tilt * -20}px)`,
                        }}
                    >
                        <span className="lp-display text-[10px] text-center leading-tight px-1" style={{ color: 'var(--lp-indigo-ink)' }}>
                            {left.label}
                        </span>
                        <span className="lp-display text-base font-bold" style={{ color: 'var(--lp-indigo)' }}>
                            ${leftVal}
                        </span>
                    </div>
                    {/* Right pan */}
                    <div
                        className="absolute top-0 right-4 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-700"
                        style={{
                            background: 'var(--lp-amber-soft)',
                            border: '3px solid var(--lp-amber)',
                            transform: `translateY(${tilt * 20}px)`,
                        }}
                    >
                        <span className="lp-display text-[10px] text-center leading-tight px-1" style={{ color: 'var(--lp-amber-ink)' }}>
                            {right.label}
                        </span>
                        <span className="lp-display text-base font-bold" style={{ color: 'var(--lp-amber)' }}>
                            ${rightVal}
                        </span>
                    </div>
                </div>
            </div>

            {/* Question */}
            <p className="lp-display text-sm mb-4 text-center" style={{ color: 'var(--lp-ink)' }}>
                {t('balance_scale.question', { defaultValue: '¿Cuál opción tiene más valor?' })}
            </p>

            {/* Options */}
            <div className="space-y-3 mb-6">
                {options.map((opt) => {
                    const isSelected = userCondition === opt.id;
                    const isCorrect = feedback !== 'none';
                    const correctAnswer = exercise?.correct_answer?.condition;
                    const isThisCorrect = correctAnswer === opt.id;

                    let stateClass = '';
                    if (isCorrect) {
                        stateClass = isThisCorrect ? 'is-correct' : isSelected ? 'is-wrong' : 'is-dimmed';
                    } else if (isSelected) {
                        stateClass = 'is-selected';
                    }

                    return (
                        <button
                            key={opt.id}
                            onClick={() => handleSelect(opt.id)}
                            disabled={feedback !== 'none'}
                            className={cn(
                                'lp-token lp-option w-full text-left px-4 py-4',
                                stateClass
                            )}
                        >
                            <span className="lp-display text-sm sm:text-base" style={{ color: 'var(--lp-ink)' }}>
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleCheck} disabled={!userCondition}>
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </QuestButton>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success'
                                ? t('actions.continue', { defaultValue: 'Continuar' })
                                : t('actions.retry', { defaultValue: 'Reintentar' })}
                            {feedback === 'success'
                                ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
