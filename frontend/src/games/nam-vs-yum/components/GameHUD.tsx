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
  coins: number;
  playerLevel: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  embeddedMode: boolean;
}

export function GameHUD({
  score,
  lives,
  maxLives,
  combo,
  comboMultiplier,
  level,
  onPause,
  coins,
  playerLevel,
  isExpanded,
  onToggleExpand,
  embeddedMode,
}: GameHUDProps) {
  const { t } = useTranslation('games');
  const [prevLives, setPrevLives] = useState(lives);
  const [livesShaking, setLivesShaking] = useState(false);
  const [comboPop, setComboPop] = useState(false);
  const [scorePop, setScorePop] = useState(false);

  useEffect(() => {
    if (lives < prevLives) {
      setLivesShaking(true);
      const timer = setTimeout(() => setLivesShaking(false), 500);
      setPrevLives(lives);
      return () => clearTimeout(timer);
    }
    setPrevLives(lives);
  }, [lives, prevLives]);

  useEffect(() => {
    if (comboMultiplier > 1) {
      setComboPop(true);
      const timer = setTimeout(() => setComboPop(false), 300);
      return () => clearTimeout(timer);
    }
  }, [comboMultiplier]);

  useEffect(() => {
    setScorePop(true);
    const timer = setTimeout(() => setScorePop(false), 200);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ zIndex: 60 }}>
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        {/* Score + Level + Coins */}
        <div className="flex flex-col items-start gap-0.5 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="pixel-font text-indigo-400 text-[8px] sm:text-[10px] uppercase">
              {t('namVsYum.hud.score')}
            </span>
            <span className={cn(
              'pixel-font text-white text-xs sm:text-sm',
              scorePop && 'animate-score-pop'
            )}>
              {score}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="pixel-font text-cyan-300 text-[7px] sm:text-[9px]">
              {t('namVsYum.hud.level', { level })}
            </span>
            <span className="pixel-font text-purple-300 text-[7px] sm:text-[9px]">
              Lv.{playerLevel}
            </span>
            <span className="pixel-font text-indigo-400 text-[7px] sm:text-[9px]">
              💰{coins}
            </span>
          </div>
          {combo >= 2 && (
            <div className={cn('flex items-center gap-1', comboPop && 'combo-pop')}>
              <span className="pixel-font text-violet-400 text-[7px] sm:text-[9px]">
                {t('namVsYum.hud.combo')}
              </span>
              <span className="pixel-font text-violet-300 text-[9px] sm:text-xs font-bold">
                {t('namVsYum.hud.comboMultiplier', { multiplier: comboMultiplier })}
              </span>
            </div>
          )}
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
          {embeddedMode && !isExpanded && (
            <button
              onClick={onToggleExpand}
              className="pointer-events-auto p-1.5 rounded-lg bg-black/40 hover:bg-black/60 active:bg-black/80 transition-colors"
              aria-label={t('namVsYum.hud.expand')}
              title={t('namVsYum.hud.expand')}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
          {embeddedMode && isExpanded && (
            <button
              onClick={onToggleExpand}
              className="pointer-events-auto p-1.5 rounded-lg bg-black/40 hover:bg-black/60 active:bg-black/80 transition-colors"
              aria-label={t('namVsYum.hud.collapse')}
              title={t('namVsYum.hud.collapse')}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
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
          <div className="pixel-font text-[8px] sm:text-[10px] text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full blink-text retro-glow">
            {t('namVsYum.hud.savingsStreak')}
          </div>
        </div>
      )}
    </div>
  );
}
