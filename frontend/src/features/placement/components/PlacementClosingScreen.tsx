import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Star } from 'lucide-react';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { StreakCelebration } from '@/components/ui/StreakCelebration';
import type { PlacementResult } from '@/lib/guestProfile';

interface Props {
  result: PlacementResult | null;
  name: string;
  onContinue: () => void;
}

export function PlacementClosingScreen({ result, name, onContinue }: Props) {
  const { t } = useTranslation('placement');
  const [showStreak, setShowStreak] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowStreak(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-300">
        <div className="relative w-full flex justify-center mt-2 mb-6 pointer-events-none">
          <div className="absolute bottom-4 w-48 h-48 rounded-full z-0 bg-emerald-400/20 dark:bg-emerald-500/15 blur-2xl" />
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 drop-shadow-2xl z-10">
            <DinoCharacter mood="excited" showBubble currentText={t('closing.liruf_bubble', { name, adventure: result?.finalAdventure ?? '-', saga: result?.finalSaga ?? '-' })} bubblePosition="standard" />
          </div>
        </div>

        <div className="w-full px-2 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-300 delay-100 fill-mode-both">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {result?.skipped ? t('closing.skipped_title', { name }) : t('closing.title', { name })}
          </h2>

          {result && !result.skipped && (
            <div className="flex items-center gap-2 mb-4 px-5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-400/20">
              <Star className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {t('closing.saga_start', { adventure: result.finalAdventure, saga: result.finalSaga })}
              </span>
            </div>
          )}

          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed max-w-xs">
            {result?.skipped ? t('closing.skipped_body') : t('closing.body')}
          </p>

          <div className="flex items-center justify-center gap-2 mb-8 w-max rounded-full py-1.5 px-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <div className="w-12 h-12 flex items-center justify-center -ml-3 -my-2 overflow-visible">
              <dotlottie-wc
                src="https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie"
                autoplay
                loop
                style={{ width: '56px', height: '56px', flexShrink: 0, pointerEvents: 'none' }}
              />
            </div>
            <div className="flex items-center gap-1.5 -ml-1">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-amber-400 to-amber-600 drop-shadow-sm">
                1
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-[0.22em] text-[11px] mt-0.5">
                {t('closing.streak_label')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="corp-btn-primary group w-full max-w-sm h-12 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {t('closing.cta')}
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]" />
          </button>
        </div>
      </div>

      <StreakCelebration
        isVisible={showStreak}
        streakCount={1}
        xpGained={50}
        onComplete={() => setShowStreak(false)}
      />
    </>
  );
}
