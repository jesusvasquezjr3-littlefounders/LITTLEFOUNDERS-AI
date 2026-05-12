import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';
import { Trophy, ShoppingBag, BarChart3, Award } from 'lucide-react';
import type { PlayerProgress } from '../types';

interface GameStartScreenProps {
  highScore: number;
  onPlay: () => void;
  onTutorial: () => void;
  onAchievements: () => void;
  onShop: () => void;
  onStats: () => void;
  onLeaderboard: () => void;
  playerProgress: PlayerProgress;
}

export function GameStartScreen({ highScore, onPlay, onTutorial, onAchievements, onShop, onStats, onLeaderboard, playerProgress }: GameStartScreenProps) {
  const { t } = useTranslation('games');
  const [ready, setReady] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Easter egg: click logo 5 times
  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        // Trigger pixel extreme mode
        return 0;
      }
      return next;
    });
  };

  const unlockedCount = Object.values(playerProgress.achievements).filter((a) => a.unlocked).length;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6 game-bg-sky relative overflow-hidden">
      {/* Background stars/particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse-scale"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: 0.3 + Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex flex-col items-center gap-3 sm:gap-4 transition-all duration-700',
          ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        )}
      >
        {/* Logo */}
        <div className="animate-float cursor-pointer" onClick={handleLogoClick}>
          <AssetImg
            assetPath={PICTURES.logo}
            alt={t('namVsYum.title')}
            className="w-32 h-32 sm:w-44 sm:h-44 object-contain pixel-art"
            draggable={false}
            fallback={
              <div className="w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center">
                <span className="text-5xl">🎮</span>
              </div>
            }
          />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="pixel-font text-lg sm:text-xl md:text-2xl text-white retro-glow mb-1">
            {t('namVsYum.title')}
          </h1>
          <p className="pixel-font text-[9px] sm:text-xs text-cyan-300">
            {t('namVsYum.subtitle')}
          </p>
        </div>

        {/* Player info bar */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-black/40 rounded-full">
          <span className="pixel-font text-[7px] text-purple-300">
            Lv.{playerProgress.playerLevel}
          </span>
          <span className="pixel-font text-[7px] text-yellow-400">
            💰 {playerProgress.coins}
          </span>
          <span className="pixel-font text-[7px] text-green-400">
            🏆 {unlockedCount}/19
          </span>
        </div>

        {/* Monsters preview */}
        <div className="flex items-end gap-6 sm:gap-10 my-1">
          {/* Vitalio */}
          <div className="flex flex-col items-center gap-1 animate-bounce-in">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-b from-green-600 to-green-800 rounded-xl flex items-center justify-center">
              <AssetImg
                assetPath={PICTURES.vitalio}
                alt={t('namVsYum.monsters.vitalio')}
                className="w-full h-full object-contain pixel-art p-1"
                draggable={false}
                fallback={<span className="text-2xl">🦎</span>}
              />
            </div>
            <span className="pixel-font text-[7px] sm:text-[8px] text-green-300">
              {t('namVsYum.monsters.vitalio')}
            </span>
          </div>

          <span className="pixel-font text-lg sm:text-xl text-yellow-400 mb-4">VS</span>

          {/* Capricho */}
          <div className="flex flex-col items-center gap-1 animate-bounce-in" style={{ animationDelay: '0.15s' }}>
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-b from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
              <AssetImg
                assetPath={PICTURES.capricho}
                alt={t('namVsYum.monsters.capricho')}
                className="w-full h-full object-contain pixel-art p-1"
                draggable={false}
                fallback={<span className="text-2xl">👾</span>}
              />
            </div>
            <span className="pixel-font text-[7px] sm:text-[8px] text-purple-300">
              {t('namVsYum.monsters.capricho')}
            </span>
          </div>
        </div>

        {/* High Score */}
        {highScore > 0 && (
          <p className="pixel-font text-[8px] sm:text-[10px] text-yellow-300">
            {t('namVsYum.startScreen.highScore', { score: highScore })}
          </p>
        )}

        {/* Play Button */}
        <button
          onClick={onPlay}
          className={cn(
            'pixel-font text-sm sm:text-base px-8 py-3 sm:px-10 sm:py-4',
            'bg-green-500 hover:bg-green-400 active:bg-green-600',
            'text-white rounded-lg border-b-4 border-green-700',
            'hover:border-green-500 active:border-b-0 active:mt-1',
            'transition-all duration-100',
            'shadow-lg shadow-green-500/30',
            'blink-text',
          )}
        >
          {t('namVsYum.startScreen.playButton')}
        </button>

        {/* Secondary buttons */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onAchievements}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={t('namVsYum.startScreen.achievements')}
          >
            <Award className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={onShop}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={t('namVsYum.startScreen.shop')}
          >
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
          </button>
          <button
            onClick={onStats}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={t('namVsYum.startScreen.stats')}
          >
            <BarChart3 className="w-4 h-4 text-green-400" />
          </button>
          <button
            onClick={onLeaderboard}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={t('namVsYum.startScreen.leaderboard')}
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
          </button>
        </div>

        <button
          onClick={onTutorial}
          className="pixel-font text-[8px] sm:text-[10px] text-white/60 hover:text-white/90 underline transition-colors"
        >
          {t('namVsYum.startScreen.howToPlay')}
        </button>

        {/* Description */}
        <p className="pixel-font text-[7px] sm:text-[8px] text-white/40 text-center max-w-xs mt-1">
          {t('namVsYum.startScreen.description')}
        </p>
      </div>
    </div>
  );
}
