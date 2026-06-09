import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { GAME_CONFIG } from '../constants';

interface FrenzyBarProps {
  frenzyCount: number;
  isFrenzyMode: boolean;
}

export function FrenzyBar({ frenzyCount, isFrenzyMode }: FrenzyBarProps) {
  const { t } = useTranslation('games');
  const progress = Math.min(frenzyCount / GAME_CONFIG.frenzyThreshold, 1);

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 60 }}>
      <div className="flex flex-col items-center gap-1">
        <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 rounded-full',
              isFrenzyMode ? 'bg-pink-500 animate-pulse' : 'bg-violet-400'
            )}
            style={{ width: `${isFrenzyMode ? 100 : progress * 100}%` }}
          />
        </div>
        {isFrenzyMode && (
          <span className="pixel-font text-[7px] text-pink-400 animate-pulse retro-glow">
            {t('namVsYum.frenzy.modeActive')}
          </span>
        )}
      </div>
    </div>
  );
}
