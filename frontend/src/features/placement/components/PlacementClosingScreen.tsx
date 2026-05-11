import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-700">
        <div className="relative w-full flex justify-center mt-2 mb-6 pointer-events-none">
          <div
            className="absolute bottom-4 w-48 h-48 rounded-full z-0"
            style={{
              background: 'radial-gradient(circle,rgba(16,185,129,0.22) 0%,transparent 70%)',
              filter: 'blur(28px)',
            }}
          />
          <div className="relative w-44 h-56 drop-shadow-2xl z-10">
            <DinoCharacter mood="excited" showBubble currentText={t('closing.liruf_bubble', { name, adventure: result?.finalAdventure ?? '-', saga: result?.finalSaga ?? '-' })} bubblePosition="standard" />
          </div>
        </div>

        <div className="w-full px-2 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
            {t('closing.title', { name })}
          </h2>

          {result && (
            <div className={cn(
              'flex items-center gap-2 mb-4 px-5 py-2.5 rounded-2xl',
              'bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-400/20',
            )}>
              <Star className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {t('closing.saga_start', { adventure: result.finalAdventure, saga: result.finalSaga })}
              </span>
            </div>
          )}

          <p className="text-gray-500 dark:text-white/60 text-sm font-medium mb-8 leading-relaxed max-w-xs">
            {t('closing.body')}
          </p>

          <div className={cn(
            'flex items-center justify-center gap-2 mb-8 w-max',
            'bg-gradient-to-r from-orange-500/10 to-amber-500/10',
            'border border-orange-500/20 dark:border-orange-500/10',
            'rounded-full py-1.5 px-6',
          )}>
            <div className="w-12 h-12 flex items-center justify-center -ml-3 -my-2 overflow-visible">
              {/* @ts-ignore */}
              <dotlottie-wc
                src="https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie"
                autoplay
                loop
                style={{ width: '56px', height: '56px', flexShrink: 0, pointerEvents: 'none' }}
              />
            </div>
            <div className="flex items-center gap-1.5 -ml-1">
              <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-br from-[#FFD060] to-[#FF8C00] drop-shadow-sm">
                1
              </span>
              <span className="text-orange-600/90 dark:text-orange-400/90 font-bold uppercase tracking-widest text-[11px] mt-0.5">
                {t('closing.streak_label')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className={cn(
              'relative group w-full max-w-sm py-4 rounded-2xl font-black text-white text-base',
              'transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] overflow-hidden',
            )}
            style={{
              background: 'linear-gradient(135deg,#10b981 0%,#0891b2 100%)',
              boxShadow: '0 12px 32px rgba(16,185,129,0.45)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <span
              className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)' }}
            />
            <span className="relative flex items-center justify-center gap-2">
              {t('closing.cta')}
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </span>
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
