import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { cn } from '@/lib/utils';

interface GameStartScreenProps {
  highScore: number;
  onPlay: () => void;
  onTutorial: () => void;
}

export function GameStartScreen({ highScore, onPlay, onTutorial }: GameStartScreenProps) {
  const { t } = useTranslation('games');
  const [vitalioError, setVitalioError] = useState(false);
  const [caprichoError, setCaprichoError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [ready, setReady] = useState(false);

  // Entrance animation delay
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
          'flex flex-col items-center gap-4 sm:gap-6 transition-all duration-700',
          ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        )}
      >
        {/* Logo */}
        <div className="animate-float">
          {!logoError ? (
            <img
              src={PICTURES.logo}
              alt={t('namVsYum.title')}
              className="w-40 h-40 sm:w-52 sm:h-52 object-contain pixel-art"
              onError={() => setLogoError(true)}
              draggable={false}
            />
          ) : (
            <div className="w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center">
              <span className="text-6xl">🎮</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="pixel-font text-xl sm:text-2xl md:text-3xl text-white retro-glow mb-2">
            {t('namVsYum.title')}
          </h1>
          <p className="pixel-font text-[9px] sm:text-xs text-cyan-300">
            {t('namVsYum.subtitle')}
          </p>
        </div>

        {/* Monsters preview */}
        <div className="flex items-end gap-8 sm:gap-12 my-2">
          {/* Vitalio */}
          <div className="flex flex-col items-center gap-1 animate-bounce-in">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-b from-green-600 to-green-800 rounded-xl flex items-center justify-center">
              {!vitalioError ? (
                <img
                  src={PICTURES.vitalio}
                  alt={t('namVsYum.monsters.vitalio')}
                  className="w-full h-full object-contain pixel-art p-1"
                  onError={() => setVitalioError(true)}
                  draggable={false}
                />
              ) : (
                <span className="text-3xl">🦎</span>
              )}
            </div>
            <span className="pixel-font text-[7px] sm:text-[8px] text-green-300">
              {t('namVsYum.monsters.vitalio')}
            </span>
          </div>

          <span className="pixel-font text-lg sm:text-xl text-yellow-400 mb-6">VS</span>

          {/* Capricho */}
          <div className="flex flex-col items-center gap-1 animate-bounce-in" style={{ animationDelay: '0.15s' }}>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-b from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
              {!caprichoError ? (
                <img
                  src={PICTURES.capricho}
                  alt={t('namVsYum.monsters.capricho')}
                  className="w-full h-full object-contain pixel-art p-1"
                  onError={() => setCaprichoError(true)}
                  draggable={false}
                />
              ) : (
                <span className="text-3xl">👾</span>
              )}
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

        {/* Buttons */}
        <div className="flex flex-col items-center gap-3 mt-2">
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

          <button
            onClick={onTutorial}
            className="pixel-font text-[8px] sm:text-[10px] text-white/60 hover:text-white/90 underline transition-colors"
          >
            {t('namVsYum.startScreen.howToPlay')}
          </button>
        </div>

        {/* Description */}
        <p className="pixel-font text-[7px] sm:text-[8px] text-white/40 text-center max-w-xs mt-2">
          {t('namVsYum.startScreen.description')}
        </p>
      </div>
    </div>
  );
}
