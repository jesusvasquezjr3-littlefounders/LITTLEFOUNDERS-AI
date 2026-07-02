import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { QuestButton } from '../ui/QuestButton';

interface ImageHotspotProps {
    exercise: any;
    onSubmit: (hotspotIds: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ImageHotspot = ({ exercise, onSubmit, onNext, onRetry }: ImageHotspotProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const content = exercise?.content || {};
    const imageUrl = content.imageUrl || content.image || '';
    const hotspots = content.hotspots || [];
    const instruction = content.instruction || content.question || '';

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setSelected(new Set());
        setFeedback('none');
    }, [exercise]);

    const toggleHotspot = (id: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCheck = () => {
        if (selected.size === 0) {
            playSound('edu_error');
            return;
        }
        const isCorrect = onSubmit([...selected]);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') onNext();
        else {
            setSelected(new Set());
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Instruction */}
            {instruction && (
                <div className="mb-4 p-4 rounded-full" style={{ background: 'var(--lp-indigo-soft)', border: '1.5px solid var(--lp-indigo)' }}>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                        {instruction}
                    </p>
                </div>
            )}

            {/* Image with hotspot overlay */}
            <div className="relative w-full rounded-[2rem] overflow-hidden shadow-sm mb-4" style={{ background: 'var(--lp-surface)', border: '1px solid var(--lp-line)' }}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt=""
                        className="w-full h-auto block"
                        style={{ minHeight: 200 }}
                    />
                ) : (
                    <div className="w-full flex items-center justify-center py-20" style={{ background: 'var(--lp-bg-2)' }}>
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('image_hotspot.no_image', { defaultValue: 'Sin imagen' })}
                        </span>
                    </div>
                )}

                {/* Hotspot buttons overlaid on image */}
                {hotspots.map((hs: any) => {
                    const isSelected = selected.has(hs.id);
                    const isCorrect = feedback !== 'none';
                    const correctIds = new Set(exercise?.correct_answer?.hotspotIds || exercise?.correct_answer?.hotspot_ids || []);
                    const isThisCorrect = correctIds.has(hs.id);

                    let borderColor = 'var(--lp-indigo)';
                    let bgColor = 'rgba(91,110,245,0.3)';
                    if (isCorrect) {
                        borderColor = isThisCorrect ? 'var(--lp-emerald)' : 'var(--lp-coral)';
                        bgColor = isThisCorrect ? 'rgba(16,185,129,0.35)' : 'rgba(248,113,113,0.3)';
                    } else if (isSelected) {
                        borderColor = 'var(--lp-emerald)';
                        bgColor = 'rgba(16,185,129,0.35)';
                    }

                    return (
                        <button
                            key={hs.id}
                            onClick={() => toggleHotspot(hs.id)}
                            disabled={feedback !== 'none'}
                            className={cn(
                                'absolute rounded-full border-[3px] transition-all duration-200',
                                'flex items-center justify-center',
                                !isSelected && !isCorrect && 'opacity-70 hover:opacity-100 hover:scale-110',
                                isSelected && 'opacity-100 scale-110',
                                isCorrect && 'opacity-100'
                            )}
                            style={{
                                left: `${hs.x}px`,
                                top: `${hs.y}px`,
                                width: `${(hs.radius || 30) * 2}px`,
                                height: `${(hs.radius || 30) * 2}px`,
                                transform: 'translate(-50%, -50%)',
                                borderColor,
                                background: bgColor,
                            }}
                            aria-label={hs.label || hs.id}
                            title={hs.label || hs.id}
                        >
                            {isSelected && !isCorrect && (
                                <span className="text-white text-xs font-bold">✓</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected count */}
            {feedback === 'none' && (
                <p className="lp-display text-xs mb-4 text-center" style={{ color: 'var(--lp-muted)' }}>
                    {selected.size} {t('image_hotspot.selected', { defaultValue: 'seleccionada(s)' })}
                </p>
            )}

            {/* Actions */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleCheck} disabled={selected.size === 0}>
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </QuestButton>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success'
                                ? t('status.correct', { defaultValue: '¡Correcto!' })
                                : t('image_hotspot.try_again', { defaultValue: 'Inténtalo de nuevo' })}
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
