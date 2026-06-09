import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import type { GameState } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  state: GameState;
  onRetry: () => void;
  onExit: () => void;
  onWardrobe: () => void;
}

export function GameOverScreen({ state, onRetry, onExit, onWardrobe }: Props) {
  const { t } = useTranslation('games');

  const isNewHighScore = state.score > 0 && state.score >= state.highScore;

  return (
    <div className="absolute inset-0 pd-bg flex flex-col items-center justify-center pd-font overflow-hidden p-4">

      {/* Detective falls */}
      <div className="relative mb-4" style={{ height: 160, width: 200 }}>
        <AssetImg
          assetPath={PICTURES.detective}
          alt="Detective"
          className="pd-detective-fall absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-contain opacity-90"
          draggable={false}
          fallback={<div className="pd-detective-fall absolute bottom-0 left-1/2 -translate-x-1/2 text-8xl">😵</div>}
        />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-black text-blue-900 mb-1 pd-slide-up">
        {t('paperDetective.gameOver.title')}
      </h1>

      {isNewHighScore && (
        <div className="pd-card px-4 py-1 mb-3 pd-combo-badge"
          style={{ background: '#f1c40f', borderColor: '#d68910' }}>
          <span className="text-sm font-black text-blue-900">
            🏆 {t('paperDetective.gameOver.newHighScore')}
          </span>
        </div>
      )}

      {/* Stats card */}
      <div className="pd-card w-full max-w-xs p-5 mb-5 pd-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-blue-200 pb-2">
            <span className="text-sm font-bold text-blue-700">
              🏅 {t('paperDetective.gameOver.finalScore')}
            </span>
            <span className="text-2xl font-black text-blue-900">{state.score}</span>
          </div>
          <div className="flex justify-between items-center border-b border-blue-200 pb-2">
            <span className="text-sm font-bold text-blue-700">
              🥇 {t('paperDetective.gameOver.highScore', { score: state.highScore })}
            </span>
            <span className="text-lg font-black text-blue-800">{state.highScore}</span>
          </div>
          <div className="flex justify-between items-center border-b border-blue-200 pb-2">
            <span className="text-sm font-bold text-blue-700">
              📅 {t('paperDetective.gameOver.daysReached', { day: state.dayNumber })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-blue-700">
              ⭐ {t('paperDetective.gameOver.pointsEarned', { points: state.sessionPoints })}
            </span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs pd-slide-up" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={onRetry}
          className="pd-btn pd-btn-primary py-4 text-base font-black"
        >
          🔄 {t('paperDetective.gameOver.retry')}
        </button>
        <button
          onClick={onWardrobe}
          className="pd-btn pd-btn-green py-3 text-sm font-bold"
        >
          👔 {t('paperDetective.gameOver.wardrobe')}
        </button>
        <button
          onClick={onExit}
          className="pd-btn py-3 text-sm font-bold text-blue-700"
        >
          🚪 {t('paperDetective.gameOver.exit')}
        </button>
      </div>
    </div>
  );
}
