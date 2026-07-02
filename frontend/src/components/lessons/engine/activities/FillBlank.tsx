import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface FillBlankProps {
    exercise: any;
    onSubmit: (answer: any) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const FillBlank = ({ exercise, onSubmit, onNext, onRetry }: FillBlankProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [textInput, setTextInput] = useState('');
    const [selectedWords, setSelectedWords] = useState<Record<number, string>>({});
    const [wordBank, setWordBank] = useState<any[]>([]);
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};

    // Detect which format we have:
    // Legacy: segments + options (word bank drag-and-drop)
    // Real JSON: statement + hint (free text input)
    const hasLegacyFormat = Array.isArray(content.segments) && content.segments.length > 0;
    const hasWordBank = Array.isArray(content.options) && content.options.length > 0;
    const statement = content.statement || '';
    const hint = content.hint || '';

    // How many blanks the answer expects (used when the statement has no ____ tokens).
    const expectedBlankCount = (): number => {
        const ca = exercise?.correct_answer || {};
        for (const k of ['blanks', 'values', 'words', 'filledBlanks', 'answers', 'gaps', 'correctSequence', 'correctOrder', 'correctBlanks']) {
            if (Array.isArray(ca[k]) && ca[k].length > 0) return ca[k].length;
        }
        const numKeys = Object.keys(ca).filter((k) => /^(blank|b|gap|w|__|p)?_?\d+_?_?$/i.test(k));
        if (numKeys.length > 0) return numKeys.length;
        return 1;
    };

    // Build segments from statement if using real JSON format.
    let segments = hasLegacyFormat
        ? content.segments
        : (statement ? parseStatementToSegments(statement) : []);

    // Word-bank exercises whose statement has NO ____ tokens: synthesize blank slots
    // so the picked words have somewhere to land (otherwise the activity is unanswerable).
    if (hasWordBank && !hasLegacyFormat && !segments.some((s: any) => s.type === 'blank')) {
        const n = expectedBlankCount();
        const synthetic: Array<{ type: 'text' | 'blank'; text?: string; id?: string }> = [];
        if (statement) synthetic.push({ type: 'text', text: statement + ' ' });
        for (let i = 0; i < n; i++) synthetic.push({ type: 'blank', id: `blank-${i}` });
        segments = synthetic;
    }

    useEffect(() => {
        setTextInput('');
        setSelectedWords({});
        setIsChecked(false);
        setFeedback('none');

        if (hasWordBank) {
            const shuffled = [...content.options];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setWordBank(shuffled);
        } else {
            setWordBank([]);
        }
    }, [exercise, hasWordBank, content.options]);

    // Parse a statement like "La gran ________ entre Ana y Ben fue de 40 monedas."
    // into segments array [{type:'text', text:'La gran '}, {type:'blank'}, {type:'text', text:' entre...'}]
    function parseStatementToSegments(stmt: string): Array<{ type: 'text' | 'blank'; text?: string; id?: string }> {
        const result: Array<{ type: 'text' | 'blank'; text?: string; id?: string }> = [];
        const regex = /(_{2,})/g;
        let lastIndex = 0;
        let match;
        let blankIndex = 0;
        while ((match = regex.exec(stmt)) !== null) {
            if (match.index > lastIndex) {
                result.push({ type: 'text', text: stmt.slice(lastIndex, match.index) });
            }
            result.push({ type: 'blank', id: `blank-${blankIndex}` });
            blankIndex++;
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < stmt.length) {
            result.push({ type: 'text', text: stmt.slice(lastIndex) });
        }
        return result;
    }

    const handleWordSelect = (word: any) => {
        if (isChecked) return;
        playSound('ui_tap');
        const firstEmptyIndex = segments.findIndex((seg: any, idx: number) => seg.type === 'blank' && !selectedWords[idx]);
        if (firstEmptyIndex !== -1) {
            setSelectedWords(prev => ({ ...prev, [firstEmptyIndex]: word.id }));
        }
    };

    const handleRemoveWord = (index: number) => {
        if (isChecked) return;
        playSound('ui_tap');
        const newSelected = { ...selectedWords };
        delete newSelected[index];
        setSelectedWords(newSelected);
    };

    const handleCheck = () => {
        let answer: any;
        if (hasWordBank && hasLegacyFormat) {
            // Legacy format: map of blank index -> word id
            const answerMap: Record<string, string> = {};
            segments.forEach((seg: any, idx: number) => {
                if (seg.type === 'blank' && selectedWords[idx]) {
                    const key = seg.id || String(idx);
                    answerMap[key] = selectedWords[idx];
                }
            });
            answer = answerMap;
        } else if (hasWordBank) {
            // Real JSON with word bank
            const answerMap: Record<string, string> = {};
            segments.forEach((seg: any, idx: number) => {
                if (seg.type === 'blank' && selectedWords[idx]) {
                    const key = seg.id || String(idx);
                    answerMap[key] = selectedWords[idx];
                }
            });
            answer = answerMap;
        } else {
            // Free text input
            answer = textInput.trim();
        }

        const isCorrect = onSubmit(answer);
        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setTextInput('');
            setSelectedWords({});
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const isBankWordUsed = (wordId: string) => Object.values(selectedWords).includes(wordId);
    const blankCount = segments.filter((s: any) => s.type === 'blank').length;
    const allBlanksFilled = Object.keys(selectedWords).length >= blankCount;
    const canCheck = hasWordBank ? allBlanksFilled : textInput.trim().length > 0;

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">
            {/* Statement Area */}
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 mb-6 w-full">
                <div className="lp-display flex flex-wrap gap-2 items-center justify-center text-xl sm:text-2xl leading-loose" style={{ color: "var(--lp-ink)" }}>
                    {segments.map((segment: any, idx: number) => {
                        if (segment.type === 'text') {
                            return <span key={idx} className="whitespace-pre-wrap">{segment.text}</span>;
                        } else {
                            if (!hasWordBank) {
                                // Inline Text Input
                                return (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={isChecked}
                                        autoFocus
                                        className={cn(
                                            "lp-display min-w-[120px] max-w-[250px] h-12 px-3 rounded-[var(--lp-radius-sm)] border-2 transition-all mx-1 text-center focus:outline-none focus:border-[var(--lp-indigo)]",
                                            isChecked && feedback === 'success' && "border-[var(--lp-emerald)] text-[var(--lp-emerald)] bg-[var(--lp-emerald-soft)]",
                                            isChecked && feedback === 'error' && "border-[var(--lp-coral)] text-[var(--lp-coral)] bg-[var(--lp-coral-soft)]"
                                        )}
                                        style={!isChecked ? { background: "var(--lp-surface)", borderColor: "var(--lp-line)", color: "var(--lp-ink)" } : {}}
                                    />
                                );
                            }

                            // Word Bank Slot
                            const filledWordId = selectedWords[idx];
                            const filledWord = wordBank.find((w: any) => w.id === filledWordId);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => filledWord && handleRemoveWord(idx)}
                                    className={cn(
                                        "lp-display min-w-[80px] h-11 px-3 rounded-[var(--lp-radius-sm)] border-2 transition-all mx-1 mb-1 text-center",
                                        filledWord
                                            ? "lp-token lp-option lp-option--indigo is-selected"
                                            : "animate-pulse text-transparent"
                                    )}
                                    style={filledWord
                                        ? { color: "var(--lp-indigo-ink)" }
                                        : { background: "var(--lp-bg-2)", borderColor: "var(--lp-line)" }}
                                >
                                    {filledWord ? pickText(filledWord) : "____"}
                                </button>
                            );
                        }
                    })}
                    {/* If no segments parsed (no blanks in statement), show the statement as text */}
                    {segments.length === 0 && statement && (
                        <p className="text-center">{statement}</p>
                    )}
                    {/* If no blanks and no wordbank, show fallback inline input */}
                    {segments.length === 0 && !hasWordBank && (
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            disabled={isChecked}
                            autoFocus
                            placeholder={content.placeholder || t('fill_blank.placeholder', { defaultValue: 'Respuesta...' })}
                            className="lp-display min-w-[160px] max-w-[300px] h-12 px-4 rounded-[var(--lp-radius-sm)] border-2 text-center focus:outline-none transition-colors disabled:opacity-50 focus:border-[var(--lp-indigo)] mt-4"
                            style={{ background: "var(--lp-surface)", borderColor: "var(--lp-line)", color: "var(--lp-ink)" }}
                        />
                    )}
                </div>
            </div>

            {/* Hint */}
            {hint && !isChecked && (
                <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--lp-indigo-ink)" }}>
                    <Lightbulb className="w-4 h-4" />
                    <span>{hint}</span>
                </div>
            )}

            {/* Checked Feedback */}
            {isChecked && (
                <div className="mb-6 text-center animate-in zoom-in">
                    <span className="text-4xl block mb-2">{feedback === 'success' ? '🎉' : '🤔'}</span>
                    <p className="lp-display text-xl" style={{ color: feedback === 'success' ? "var(--lp-emerald)" : "var(--lp-coral)" }}>
                        {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                    </p>
                </div>
            )}

            {/* Word Bank */}
            {hasWordBank && (
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {wordBank.map((word: any) => {
                        const isUsed = isBankWordUsed(word.id);
                        return (
                            <button
                                key={word.id}
                                onClick={() => handleWordSelect(word)}
                                disabled={isUsed || isChecked}
                                className={cn(
                                    "lp-display px-6 py-3 text-lg transition-all",
                                    isUsed
                                        ? "opacity-0 scale-50 pointer-events-none"
                                        : "lp-token lp-option lp-option--amber"
                                )}
                                style={isUsed ? undefined : { color: "var(--lp-ink)" }}
                            >
                                {pickText(word)}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Actions */}
            <div className="w-full max-w-sm">
                {!isChecked ? (
                    <QuestButton variant="gold" disabled={!canCheck} onClick={handleCheck}>
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </QuestButton>
                ) : (
                    <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                        {feedback === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                        {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </QuestButton>
                )}
            </div>
        </div>
    );
};
