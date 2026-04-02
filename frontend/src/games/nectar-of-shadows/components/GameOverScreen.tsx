/* ──────────────────────────────────────────────────────────────
   Game Over Screen – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  day: number;
  totalCoinsEarned: number;
  highScore: number;
  bestDay: number;
  isNewHighScore: boolean;
  onRetry: () => void;
  onExit: () => void;
}

export function GameOverScreen({ day, totalCoinsEarned, highScore, bestDay, isNewHighScore, onRetry, onExit }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="nectar-gameover">
      <div className="nectar-gameover-card">
        <h1 className="nectar-gameover-title">{t('nectar.gameOver.title')}</h1>

        {isNewHighScore && (
          <div className="nectar-gameover-newhigh">
            {t('nectar.gameOver.newHighScore')}
          </div>
        )}

        {/* Character */}
        <AssetImg assetPath={PICTURES.dina} alt="" className="nectar-gameover-char" />

        {/* Stats */}
        <div className="nectar-gameover-stats">
          <div className="nectar-gameover-stat">
            <span className="nectar-gameover-stat-label">{t('nectar.gameOver.daysReached')}</span>
            <span className="nectar-gameover-stat-value">{day}</span>
          </div>
          <div className="nectar-gameover-stat">
            <span className="nectar-gameover-stat-label">{t('nectar.gameOver.totalEarned')}</span>
            <span className="nectar-gameover-stat-value">
              {totalCoinsEarned}
              <AssetImg assetPath={PICTURES.coin} alt="" className="nectar-icon-xs" />
            </span>
          </div>
          <div className="nectar-gameover-stat">
            <span className="nectar-gameover-stat-label">{t('nectar.gameOver.bestRecord')}</span>
            <span className="nectar-gameover-stat-value">
              {highScore}
              <AssetImg assetPath={PICTURES.coin} alt="" className="nectar-icon-xs" />
            </span>
          </div>
          <div className="nectar-gameover-stat">
            <span className="nectar-gameover-stat-label">{t('nectar.gameOver.bestDayRecord')}</span>
            <span className="nectar-gameover-stat-value">{bestDay}</span>
          </div>
        </div>

        {/* Encouragement */}
        <p className="nectar-gameover-msg">{t('nectar.gameOver.encouragement')}</p>

        {/* Buttons */}
        <div className="nectar-gameover-buttons">
          <button className="nectar-btn nectar-btn-primary nectar-btn-glow" onClick={onRetry}>
            {t('nectar.gameOver.retry')}
          </button>
          <button className="nectar-btn nectar-btn-secondary" onClick={onExit}>
            {t('nectar.gameOver.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}
