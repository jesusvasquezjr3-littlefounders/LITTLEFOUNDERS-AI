import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverScreen({ state, onRestart }: Props) {
  const { t } = useTranslation('chronoBloom');

  const allStats = state.allStats.flat();
  const totalInterest = allStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalEnemies = allStats.reduce((s, y) => s + y.enemiesDefeated, 0);

  return (
    <div className="cb-overlay">
      <div className="cb-gameover-card">
        <div style={{ fontSize: 50, marginBottom: 8 }}>💸</div>
        <div className="cb-gameover-title">
          {t('gameOver.title')}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 13,
          color: 'rgba(239,68,68,0.7)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}>
          {t('gameOver.subtitle')}
        </p>

        <div className="cb-score-board">
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.levelReached')}</div>
            <div className="cb-score-item-value">{state.level}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.yearReached')}</div>
            <div className="cb-score-item-value">{state.year}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.finalCapital')}</div>
            <div className="cb-score-item-value gold">${state.capital}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.score')}</div>
            <div className="cb-score-item-value gold">{state.score}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.interestEarned')}</div>
            <div className="cb-score-item-value gold">+${totalInterest}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('gameOver.enemiesDefeated')}</div>
            <div className="cb-score-item-value">{totalEnemies}</div>
          </div>
        </div>

        {state.score >= state.highScore && state.score > 0 && (
          <div style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 12,
            color: '#ffd700',
            margin: '10px 0',
          }}>
            🏆 {t('gameOver.newRecord')}!
          </div>
        )}

        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          padding: '8px 12px',
          margin: '12px 0',
          fontFamily: '"Nunito", sans-serif',
          fontSize: 11,
          color: 'rgba(239,68,68,0.7)',
          lineHeight: 1.5,
        }}>
          💡 {t('gameOver.tip')}
        </div>

        <button
          className="cb-btn-danger"
          style={{ width: '100%', marginTop: 8 }}
          onClick={onRestart}
        >
          🔄 {t('gameOver.tryAgain')}
        </button>
      </div>
    </div>
  );
}
