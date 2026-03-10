/* ──────────────────────────────────────────────────────────────
   Start Screen – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';

interface Props {
  highScore: number;
  bestDay: number;
  onPlay: () => void;
  onTutorial: () => void;
}

export function GameStartScreen({ highScore, bestDay, onPlay, onTutorial }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="nectar-start-screen">
      {/* Floating particles background */}
      <div className="nectar-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="nectar-particle" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
      </div>

      {/* Logo / Title */}
      <div className="nectar-start-header">
        <img src={PICTURES.logo} alt="" className="nectar-logo" />
        <h1 className="nectar-title">{t('nectar.title')}</h1>
        <p className="nectar-subtitle">{t('nectar.subtitle')}</p>
      </div>

      {/* Character preview */}
      <div className="nectar-start-characters">
        <img src={PICTURES.liruf} alt="Liruf" className="nectar-char-preview nectar-char-bounce" />
        <img src={PICTURES.dina} alt="Dina" className="nectar-char-preview nectar-char-bounce" style={{ animationDelay: '0.3s' }} />
      </div>

      {/* Stats */}
      {(highScore > 0 || bestDay > 0) && (
        <div className="nectar-start-stats">
          {highScore > 0 && (
            <p className="nectar-stat-line">
              {t('nectar.startScreen.highScore', { score: highScore })}
            </p>
          )}
          {bestDay > 0 && (
            <p className="nectar-stat-line">
              {t('nectar.startScreen.bestDay', { day: bestDay })}
            </p>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="nectar-start-buttons">
        <button className="nectar-btn nectar-btn-primary nectar-btn-glow" onClick={onPlay}>
          {t('nectar.startScreen.playButton')}
        </button>
        <button className="nectar-btn nectar-btn-secondary" onClick={onTutorial}>
          {t('nectar.startScreen.howToPlay')}
        </button>
      </div>
    </div>
  );
}
