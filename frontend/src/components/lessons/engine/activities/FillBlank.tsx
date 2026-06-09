import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    // Build segments from statement if using real JSON format
    const segments = hasLegacyFormat
        ? content.segments
        : (statement
            ? parseStatementToSegments(statement)
            : []);

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
            <div className="bg-card p-6 rounded-3xl shadow-sm border-2 border-border mb-6 w-full">
                <div className="flex flex-wrap gap-2 items-end justify-center text-xl sm:text-2xl font-medium leading-loose">
                    {segments.map((segment: any, idx: number) => {
                        if (segment.type === 'text') {
                            return <span key={idx}>{segment.text}</span>;
                        } else {
                            const filledWordId = selectedWords[idx];
                            const filledWord = wordBank.find((w: any) => w.id === filledWordId);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => filledWord && handleRemoveWord(idx)}
                                    className={cn(
                                        "min-w-[80px] h-10 px-3 rounded-xl border-2 transition-all mx-1 mb-1 font-bold text-center translate-y-[-2px] shadow-sm",
                                        filledWord
                                            ? "bg-purple-100 text-purple-700 border-purple-300 hover:bg-red-100 hover:text-red-600 hover:border-red-300"
                                            : "bg-slate-100 border-slate-300 animate-pulse text-transparent"
                                    )}
                                >
                                    {filledWord ? filledWord.text : "____"}
                                </button>
                            );
                        }
                    })}
                    {/* If no segments parsed (no blanks in statement), show the statement as text */}
                    {segments.length === 0 && statement && (
                        <p className="text-center">{statement}</p>
                    )}
                </div>
            </div>

            {/* Hint */}
            {hint && !isChecked && (
                <div className="mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                    <Lightbulb className="w-4 h-4" />
                    <span>{hint}</span>
                </div>
            )}

            {/* Free text input when no word bank */}
            {!hasWordBank && (
                <div className="w-full mb-6">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        disabled={isChecked}
                        placeholder={content.placeholder || t('fill_blank.placeholder', { defaultValue: 'Escribe tu respuesta...' })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-medium text-center focus:border-purple-400 focus:outline-none transition-colors disabled:opacity-50"
                    />
                </div>
            )}

            {/* Checked Feedback */}
            {isChecked && (
                <div className="mb-6 text-center animate-in zoom-in">
                    <span className="text-4xl block mb-2">{feedback === 'success' ? '🎉' : '🤔'}</span>
                    <p className={cn("font-bold text-xl", feedback === 'success' ? "text-green-500" : "text-violet-500")}>
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
                                    "px-6 py-3 rounded-2xl font-bold transition-all border-2 text-lg",
                                    isUsed
                                        ? "opacity-0 scale-50 pointer-events-none"
                                        : "bg-card text-foreground border-border shadow-[0_4px_0_hsl(var(--border))] hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none"
                                )}
                            >
                                {word.text}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Actions */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={!canCheck}
                    className="w-full max-w-sm h-14 sm:h-16 text-lg sm:text-xl rounded-2xl bg-purple-500 hover:bg-purple-600 text-white shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px]"
                >
                    <span className="relative flex items-center justify-center">{t('actions.verify', { defaultValue: 'Verificar' })}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full max-w-sm h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                            : "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                        "hover:-translate-y-[2px]"
                    )}
                >
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                        <ArrowRight className="ml-2 w-6 h-6" />
                    </span>
                </Button>
            )}
        </div>
    );
};
