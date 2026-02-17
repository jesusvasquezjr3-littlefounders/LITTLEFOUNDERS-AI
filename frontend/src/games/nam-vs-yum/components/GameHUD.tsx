import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameHUDProps {
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  comboMultiplier: number;
  level: number;
  onPause: () => void;
}

export function GameHUD({
  score,
  lives,
  maxLives,
  combo,
  comboMultiplier,
  level,
  onPause,
}: GameHUDProps) {
  const { t } = useTranslation('games');
  const [prevLives, setPrevLives] = useState(lives);
  const [livesShaking, setLivesShaking] = useState(false);
  const [comboPop, setComboPop] = useState(false);

  // Detect life lost
  useEffect(() => {
    if (lives < prevLives) {
      setLivesShaking(true);
      const timer = setTimeout(() => setLivesShaking(false), 500);
      setPrevLives(lives);
      return () => clearTimeout(timer);
    }
    setPrevLives(lives);
  }, [lives, prevLives]);

  // Detect combo change
  useEffect(() => {
    if (comboMultiplier > 1) {
      setComboPop(true);
      const timer = setTimeout(() => setComboPop(false), 300);
      return () => clearTimeout(timer);
    }
  }, [comboMultiplier]);

  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ zIndex: 60 }}>
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        {/* Score + Combo */}
        <div className="flex flex-col items-start gap-0.5 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="pixel-font text-yellow-400 text-[8px] sm:text-[10px] uppercase">
              {t('namVsYum.hud.score')}
            </span>
            <span className="pixel-font text-white text-xs sm:text-sm">
              {score}
            </span>
          </div>
          {combo >= 2 && (
            <div className={cn('flex items-center gap-1', comboPop && 'combo-pop')}>
              <span className="pixel-font text-orange-400 text-[7px] sm:text-[9px]">
                {t('namVsYum.hud.combo')}
              </span>
              <span className="pixel-font text-orange-300 text-[9px] sm:text-xs font-bold">
                {t('namVsYum.hud.comboMultiplier', { multiplier: comboMultiplier })}
              </span>
            </div>
          )}
        </div>

        {/* Level */}
        <div className="pointer-events-none">
          <span className="pixel-font text-cyan-300 text-[7px] sm:text-[9px] uppercase">
            {t('namVsYum.hud.level', { level })}
          </span>
        </div>

        {/* Lives + Pause */}
        <div className="flex items-center gap-2">
          <div className={cn('flex gap-0.5', livesShaking && 'animate-shake')}>
            {Array.from({ length: maxLives }).map((_, i) => (
              <Heart
                key={i}
                className={cn(
                  'w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200',
                  i < lives
                    ? 'fill-red-500 text-red-500'
                    : 'fill-gray-700 text-gray-700',
                  i === lives && livesShaking && 'heart-breaking',
                )}
              />
            ))}
          </div>
          <button
            onClick={onPause}
            className="pointer-events-auto p-1.5 rounded-lg bg-black/40 hover:bg-black/60 active:bg-black/80 transition-colors"
            aria-label={t('namVsYum.hud.pause')}
          >
            <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Savings streak banner */}
      {combo >= 5 && (
        <div className="flex justify-center">
          <div className="pixel-font text-[8px] sm:text-[10px] text-yellow-300 bg-yellow-500/20 px-3 py-1 rounded-full blink-text retro-glow">
            {t('namVsYum.hud.savingsStreak')}
          </div>
        </div>
      )}
    </div>
  );
}
