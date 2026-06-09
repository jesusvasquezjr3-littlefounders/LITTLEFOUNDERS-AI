import { useTranslation } from 'react-i18next';
import { PICTURES, COSMETICS } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  highScore: number;
  totalPoints: number;
  equippedCosmetic: string | null;
  onPlay: () => void;
  onTutorial: () => void;
}

export function GameStartScreen({ highScore, totalPoints, equippedCosmetic, onPlay, onTutorial }: Props) {
  const { t } = useTranslation('games');

  const equippedDef = equippedCosmetic ? COSMETICS.find(c => c.id === equippedCosmetic) : null;

  return (
    <div className="absolute inset-0 pd-bg flex flex-col items-center justify-center pd-font overflow-hidden">
      {/* Decorative paper corner tears */}
      <div className="absolute top-0 left-0 w-16 h-16 opacity-30"
        style={{ background: 'radial-gradient(circle at 0 0, #a0704a 40%, transparent 70%)' }} />
      <div className="absolute top-0 right-0 w-16 h-16 opacity-30"
        style={{ background: 'radial-gradient(circle at 100% 0, #a0704a 40%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-20 h-20 opacity-30"
        style={{ background: 'radial-gradient(circle at 0 100%, #a0704a 40%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-20 h-20 opacity-30"
        style={{ background: 'radial-gradient(circle at 100% 100%, #a0704a 40%, transparent 70%)' }} />

      {/* Logo */}
      <div className="mb-2 pd-slide-up">
        <AssetImg
          assetPath={PICTURES.logo}
          alt={t('paperDetective.title')}
          className="w-64 sm:w-80 max-w-xs object-contain drop-shadow-lg"
          draggable={false}
          fallback={
            <div className="pd-card px-6 py-3 text-center">
              <h1 className="text-2xl sm:text-3xl font-black text-blue-900 leading-tight">
                🕵️ {t('paperDetective.title')}
              </h1>
              <p className="text-sm sm:text-base font-bold text-blue-700 mt-1">
                {t('paperDetective.subtitle')}
              </p>
            </div>
          }
        />
      </div>

      {/* Detective character */}
      <div className="relative mb-4" style={{ height: '180px', width: '160px' }}>
        <AssetImg
          assetPath={PICTURES.detective}
          alt="Detective"
          className="pd-detective-wobble absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-contain drop-shadow-xl"
          draggable={false}
          fallback={
            <div className="pd-detective-wobble absolute bottom-0 left-1/2 -translate-x-1/2 text-8xl select-none">
              🕵️
            </div>
          }
        />
        {/* Equipped cosmetic overlay */}
        {equippedDef && (
          <AssetImg
            assetPath={PICTURES[equippedDef.imageKey as keyof typeof PICTURES] as string}
            alt=""
            className="pd-detective-wobble absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}
      </div>

      {/* Score info */}
      <div className="pd-card px-6 py-3 text-center mb-5 pd-slide-up" style={{ animationDelay: '0.1s' }}>
        {highScore > 0 && (
          <p className="text-sm font-bold text-blue-700 mb-1">
            🏆 {t('paperDetective.startScreen.highScore', { score: highScore })}
          </p>
        )}
        <p className="text-xs text-blue-600">
          ⭐ {t('paperDetective.startScreen.totalPoints', { points: totalPoints })}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs px-4 pd-slide-up" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={onPlay}
          className="pd-btn pd-btn-primary w-full py-4 text-xl font-black tracking-wide rounded-lg"
        >
          🔍 {t('paperDetective.startScreen.playButton')}
        </button>
        <button
          onClick={onTutorial}
          className="pd-btn w-full py-3 text-sm font-bold text-blue-900 rounded-lg"
        >
          📖 {t('paperDetective.startScreen.howToPlay')}
        </button>
      </div>
    </div>
  );
}
