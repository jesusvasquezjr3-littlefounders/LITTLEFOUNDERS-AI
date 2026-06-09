import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Star, Zap, Clock } from 'lucide-react';

interface LevelCompleteScreenProps {
  level: number;
  itemsSorted: number;
  correctItems: number;
  isPerfect: boolean;
  onContinue: () => void;
}

export function LevelCompleteScreen({ level, itemsSorted, correctItems, isPerfect, onContinue }: LevelCompleteScreenProps) {
  const { t } = useTranslation('games');

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm" style={{ zIndex: 70 }}>
      <div className="flex flex-col items-center gap-4 animate-bounce-in max-w-xs w-full px-4">
        {/* Title */}
        <h2 className="pixel-font text-lg sm:text-xl text-indigo-400 retro-glow text-center">
          {t('namVsYum.levelComplete.title', { level })}
        </h2>

        {/* Stars */}
        <div className="flex gap-2">
          {[1, 2, 3].map((star) => (
            <Star
              key={star}
              className={cn(
                'w-8 h-8 sm:w-10 sm:h-10 transition-all duration-500',
                star <= (isPerfect ? 3 : correctItems >= itemsSorted * 0.8 ? 2 : 1)
                  ? 'fill-indigo-400 text-indigo-400'
                  : 'fill-gray-700 text-gray-700'
              )}
              style={{ animationDelay: `${star * 0.15}s` }}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2 w-full bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 pixel-font text-[8px] text-white/60">
              <Zap className="w-3 h-3 text-indigo-400" />
              {t('namVsYum.levelComplete.itemsSorted', { count: itemsSorted })}
            </span>
          </div>
          {isPerfect && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-green-400 fill-green-400" />
              <span className="pixel-font text-[8px] text-green-400">
                {t('namVsYum.levelComplete.perfectBonus')}
              </span>
            </div>
          )}
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          className={cn(
            'pixel-font text-xs sm:text-sm px-8 py-3 mt-2',
            'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600',
            'text-white rounded-lg border-b-4 border-cyan-700',
            'hover:border-cyan-500 active:border-b-0 active:mt-3',
            'transition-all duration-100',
            'shadow-lg shadow-cyan-500/30',
            'blink-text',
          )}
        >
          {t('namVsYum.levelComplete.continue')}
        </button>
      </div>
    </div>
  );
}
