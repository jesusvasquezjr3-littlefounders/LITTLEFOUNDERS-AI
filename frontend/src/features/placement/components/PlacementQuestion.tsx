import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import type { PlacementItem } from '../types';

// Neutral feedback phrases — pooled to avoid repetition
const FEEDBACK_ES = [
  '¡Sigamos adelante!',
  '¡Interesante! Siguiente.',
  '¡Muy bien! Continuemos.',
  '¡Vamos por más!',
  '¡Excelente! Próxima pregunta.',
  '¡Eso es! Seguimos.',
  '¡Genial! Vamos.',
  '¡Perfecto! Continuamos.',
];
const FEEDBACK_EN = [
  'Keep going!',
  'Interesting! Next one.',
  'Great! Let\'s continue.',
  'Let\'s go for more!',
  'Excellent! Next question.',
  'That\'s it! Moving on.',
  'Awesome! Let\'s go.',
  'Perfect! Continuing.',
];

let feedbackIndex = 0;
function getNextFeedback(lang: string): string {
  const pool = lang === 'en' ? FEEDBACK_EN : FEEDBACK_ES;
  const msg = pool[feedbackIndex % pool.length];
  feedbackIndex++;
  return msg;
}

interface Props {
  item: PlacementItem;
  itemNumber: number;
  onAnswer: (correct: boolean, timeSec: number) => void;
}

export function PlacementQuestion({ item, itemNumber, onAnswer }: Props) {
  const { i18n } = useTranslation('placement');
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

  const [selected, setSelected] = useState<number | boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [startTime] = useState(() => Date.now());

  // Reset state when item changes
  useEffect(() => {
    setSelected(null);
    setShowFeedback(false);
  }, [item.id]);

  const question = lang === 'en' ? item.question_en : item.question_es;
  const options = lang === 'en' ? item.options_en : item.options_es;

  function handleSelect(value: number | boolean) {
    if (selected !== null || showFeedback) return;

    const timeSec = (Date.now() - startTime) / 1000;
    let isCorrect: boolean;

    if (item.type === 'multiple_choice') {
      isCorrect = value === item.correct_index;
    } else {
      isCorrect = value === item.correct_bool;
    }

    trackEvent('placement_question_answered', {
      item_id: item.id,
      item_number: itemNumber,
      item_type: item.type,
      correct: isCorrect,
      time_sec: Math.round(timeSec * 100) / 100,
      selected_value: typeof value === 'boolean' ? String(value) : value,
    });

    setSelected(value);
    setFeedbackMsg(getNextFeedback(lang));
    setShowFeedback(true);

    // Brief pause then advance — same visual weight for correct/incorrect
    setTimeout(() => {
      onAnswer(isCorrect, timeSec);
    }, 900);
  }

  return (
    <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-right-4 duration-400">
      {/* Question number badge */}
      <div className="self-start mb-3 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-400/20">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
          #{itemNumber}
        </span>
      </div>

      {/* Question card */}
      <div className="relative rounded-2xl w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm p-6 mb-4">
        <p className="text-base font-bold text-slate-900 dark:text-white leading-snug text-center">
          {question}
        </p>
      </div>

      {/* Options */}
      {item.type === 'multiple_choice' && options && (
        <div className="w-full flex flex-col gap-2.5">
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={selected !== null}
              onClick={() => handleSelect(idx)}
              className={cn(
                'w-full rounded-xl px-5 py-3.5 text-left font-semibold text-sm transition-all duration-200 border-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50',
                selected === null
                  ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 cursor-pointer text-slate-800 dark:text-white'
                  : selected === idx
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-slate-900 dark:text-white'
                  : 'bg-white dark:bg-white/5 border-slate-200/60 dark:border-white/10 text-slate-400 dark:text-white/30 cursor-default',
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn(
                  'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  selected === idx
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-slate-300 dark:border-white/30 text-slate-400 dark:text-white/40',
                )}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* True / False */}
      {item.type === 'true_false' && (
        <div className="w-full grid grid-cols-2 gap-3">
          {([true, false] as boolean[]).map((val) => {
            const label = lang === 'en' ? (val ? 'True' : 'False') : (val ? 'Verdadero' : 'Falso');
            const emoji = val ? '✓' : '✗';
            const isSelected = selected === val;
            return (
              <button
                key={String(val)}
                type="button"
                disabled={selected !== null}
                onClick={() => handleSelect(val)}
                className={cn(
                  'rounded-xl py-5 font-bold text-lg transition-all duration-200 border-2',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50',
                  selected === null
                    ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 cursor-pointer text-slate-800 dark:text-white'
                    : isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-white/5 border-slate-200/60 dark:border-white/10 text-slate-400 dark:text-white/30 cursor-default',
                )}
              >
                <div className="text-2xl mb-1">{emoji}</div>
                <div className="text-sm">{label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Neutral feedback pill — same style for correct and incorrect */}
      {showFeedback && (
        <div className="mt-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-400/20">
            <span className="text-lg">✨</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
              {feedbackMsg}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
