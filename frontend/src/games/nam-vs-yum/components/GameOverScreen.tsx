import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState, AchievementId } from '../types';
import { MENTOR_CHARACTERS } from '../constants';
import { cn } from '@/lib/utils';
import { Trophy, Award, TrendingUp } from 'lucide-react';

interface GameOverScreenProps {
  state: GameState;
  onRetry: () => void;
  onExit: () => void;
  newAchievements: AchievementId[];
  onShowLeaderboard: () => void;
}

export function GameOverScreen({ state, onRetry, onExit, newAchievements, onShowLeaderboard }: GameOverScreenProps) {
  const { t } = useTranslation('games');
  const confettiTriggered = useRef(false);
  const isNewHighScore = state.score >= state.highScore && state.score > 0;

  // Pick a random mentor message
  const mentorTip = useMemo(() => {
    const childMentors = MENTOR_CHARACTERS.filter(
      (tip) => tip.id === 'liruf' || tip.id === 'dina'
    );
    const char = childMentors[Math.floor(Math.random() * childMentors.length)];
    const tipKey = char.tipKeys[Math.floor(Math.random() * char.tipKeys.length)];
    return { character: char.id, tipKey, nameKey: char.nameKey };
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
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6 bg-black/95 backdrop-blur-sm relative overflow-y-auto">
      {/* New High Score badge */}
      {isNewHighScore && (
        <div className="absolute top-6 pixel-font text-xs sm:text-sm text-yellow-400 animate-celebrate retro-glow flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          {t('namVsYum.gameOver.newHighScore')}
        </div>
      )}

      {/* Title */}
      <h1 className="pixel-font text-lg sm:text-2xl text-red-400 retro-glow animate-shake mb-4">
        {t('namVsYum.gameOver.title')}
      </h1>

      {/* Score display */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <span className="pixel-font text-[9px] sm:text-xs text-white/60 uppercase">
          {t('namVsYum.gameOver.finalScore')}
        </span>
        <span className="pixel-font text-2xl sm:text-4xl text-yellow-400 retro-glow">
          {state.score}
        </span>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-2 mb-4 bg-white/5 rounded-xl p-4 w-full max-w-xs">
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

      {/* New achievements */}
      {newAchievements.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-4 w-full max-w-xs">
          <p className="pixel-font text-[8px] text-amber-400 flex items-center gap-1">
            <Award className="w-3 h-3" />
            {t('namVsYum.gameOver.newAchievements')}
          </p>
          <div className="flex flex-wrap gap-1">
            {newAchievements.map((id) => (
              <span
                key={id}
                className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg pixel-font text-[7px] text-amber-300"
              >
                {t(`namVsYum.achievements.${id}.title`)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mentor encouragement */}
      {mentorTip && (
        <div className="bg-white/5 rounded-xl p-3 mb-4 max-w-xs w-full border border-white/10">
          <p className="pixel-font text-[7px] text-yellow-300 mb-1">
            {t(mentorTip.nameKey)}
          </p>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            {t(mentorTip.tipKey)}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col items-center gap-2">
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
          onClick={onShowLeaderboard}
          className={cn(
            'pixel-font text-[8px] sm:text-[10px] px-6 py-2',
            'bg-amber-600 hover:bg-amber-500 active:bg-amber-700',
            'text-white rounded-lg border-b-4 border-amber-800',
            'hover:border-amber-600 active:border-b-0 active:mt-1',
            'transition-all duration-100',
            'flex items-center gap-2',
          )}
        >
          <TrendingUp className="w-3 h-3" />
          {t('namVsYum.gameOver.leaderboard')}
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
