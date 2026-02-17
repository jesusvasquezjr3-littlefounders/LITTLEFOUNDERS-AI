import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { MENTOR_TIPS } from '../constants';
import { cn } from '@/lib/utils';

interface GameOverScreenProps {
  state: GameState;
  onRetry: () => void;
  onExit: () => void;
}

export function GameOverScreen({ state, onRetry, onExit }: GameOverScreenProps) {
  const { t } = useTranslation('games');
  const confettiTriggered = useRef(false);
  const isNewHighScore = state.score >= state.highScore && state.score > 0;

  // Pick a random mentor message
  const mentorTip = useMemo(() => {
    // Prefer Liruf/Dina for game over messages (the children companions)
    const childMentors = MENTOR_TIPS.filter(
      (tip) => tip.character === 'liruf' || tip.character === 'dina'
    );
    return childMentors[Math.floor(Math.random() * childMentors.length)];
  }, []);

  // Trigger confetti for new high score
  useEffect(() => {
    if (isNewHighScore && !confettiTriggered.current) {
      confettiTriggered.current = true;
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.4 },
          colors: ['#FFD700', '#22C55E', '#A855F7', '#EF4444', '#06B6D4'],
        });
      });
    }
  }, [isNewHighScore]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6 bg-black/95 backdrop-blur-sm relative overflow-hidden">
      {/* New High Score badge */}
      {isNewHighScore && (
        <div className="absolute top-8 pixel-font text-xs sm:text-sm text-yellow-400 animate-celebrate retro-glow">
          {t('namVsYum.gameOver.newHighScore')}
        </div>
      )}

      {/* Title */}
      <h1 className="pixel-font text-lg sm:text-2xl text-red-400 retro-glow animate-shake mb-6">
        {t('namVsYum.gameOver.title')}
      </h1>

      {/* Score display */}
      <div className="flex flex-col items-center gap-1 mb-6">
        <span className="pixel-font text-[9px] sm:text-xs text-white/60 uppercase">
          {t('namVsYum.gameOver.finalScore')}
        </span>
        <span className="pixel-font text-2xl sm:text-4xl text-yellow-400 retro-glow">
          {state.score}
        </span>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-2 mb-6 bg-white/5 rounded-xl p-4 w-full max-w-xs">
        <div className="flex justify-between">
          <span className="pixel-font text-[7px] sm:text-[9px] text-white/60">
            {t('namVsYum.gameOver.itemsSorted', { count: state.itemsSorted })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="pixel-font text-[7px] sm:text-[9px] text-white/60">
            {t('namVsYum.gameOver.maxCombo', { combo: state.maxCombo })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="pixel-font text-[7px] sm:text-[9px] text-white/60">
            {t('namVsYum.gameOver.levelReached', { level: state.level })}
          </span>
        </div>
      </div>

      {/* Mentor encouragement */}
      {mentorTip && (
        <div className="bg-white/5 rounded-xl p-3 mb-6 max-w-xs w-full border border-white/10">
          <p className="pixel-font text-[7px] text-yellow-300 mb-1">
            {t(mentorTip.nameKey)}
          </p>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            {t(mentorTip.tipKey)}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onRetry}
          className={cn(
            'pixel-font text-xs sm:text-sm px-8 py-3',
            'bg-green-500 hover:bg-green-400 active:bg-green-600',
            'text-white rounded-lg border-b-4 border-green-700',
            'hover:border-green-500 active:border-b-0 active:mt-1',
            'transition-all duration-100',
            'shadow-lg shadow-green-500/30',
            'blink-text',
          )}
        >
          {t('namVsYum.gameOver.retry')}
        </button>

        <button
          onClick={onExit}
          className="pixel-font text-[8px] sm:text-[10px] text-white/50 hover:text-white/80 transition-colors"
        >
          {t('namVsYum.gameOver.exit')}
        </button>
      </div>
    </div>
  );
}
