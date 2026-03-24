import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onNext: () => void;
}

function getStars(state: GameState): number {
  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const data = state.yearResultData;
  const totalInterest = state.allStats[state.level - 1]?.reduce((s, y) => s + y.interestEarned, 0) ?? 0;
  if (hpPct >= 0.7 && state.liquidatedEarly === 0) return 3;
  if (hpPct >= 0.4 && totalInterest > 0) return 2;
  return 1;
}

export default function LevelCompleteScreen({ state, onNext }: Props) {
  const { t } = useTranslation('chronoBloom');
  const stars = getStars(state);
  const isLastLevel = state.level >= GAME_CONFIG.maxLevel;

  const levelStats = state.allStats[state.level - 1] || [];
  const totalInterest = levelStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalEnemies = levelStats.reduce((s, y) => s + y.enemiesDefeated, 0);
  const totalStolen = levelStats.reduce((s, y) => s + y.capitalStolenByEnemies, 0);
  const hadBear = levelStats.some(y => y.bearMarketHit);

  return (
    <div className="cb-overlay">
      <div className="cb-victory-card">
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {isLastLevel ? '🏆' : '🎉'}
        </div>
        <div className="cb-victory-title">
          {isLastLevel ? t('levelComplete.victoryTitle') : t('levelComplete.title', { level: state.level })}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 13,
          color: 'rgba(134,239,172,0.7)',
          marginBottom: 16,
          lineHeight: 1.5,
        }}>
          {isLastLevel ? t('levelComplete.victoryDesc') : t('levelComplete.desc', { level: state.level })}
        </p>

        {/* Stars */}
        <div className="cb-stars">
          {[1, 2, 3].map(s => (
            <span key={s} className={`cb-star ${s <= stars ? 'lit' : ''}`}>⭐</span>
          ))}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 12,
          color: 'rgba(134,239,172,0.6)',
          marginBottom: 20,
        }}>
          {stars === 3 ? t('levelComplete.stars3') :
           stars === 2 ? t('levelComplete.stars2') :
           t('levelComplete.stars1')}
        </p>

        {/* Stats */}
        <div className="cb-score-board">
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('levelComplete.totalInterest')}</div>
            <div className="cb-score-item-value gold">+${totalInterest}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('levelComplete.enemiesDefeated')}</div>
            <div className="cb-score-item-value">{totalEnemies}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('levelComplete.capitalProtected')}</div>
            <div className="cb-score-item-value gold">${state.capital}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('levelComplete.capitalLost')}</div>
            <div className="cb-score-item-value orange">${totalStolen}</div>
          </div>
        </div>

        {hadBear && (
          <div style={{
            background: 'rgba(251,146,60,0.1)',
            border: '1px solid rgba(251,146,60,0.3)',
            borderRadius: 8,
            padding: '6px 12px',
            margin: '10px 0',
            fontFamily: '"Nunito", sans-serif',
            fontSize: 11,
            color: '#fb923c',
          }}>
            📉 {t('levelComplete.survivedBear')}
          </div>
        )}

        {!isLastLevel && (
          <div style={{
            background: 'rgba(74,222,128,0.1)',
            border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 8,
            padding: '8px 12px',
            margin: '10px 0',
            fontFamily: '"Nunito", sans-serif',
            fontSize: 12,
            color: '#4ade80',
          }}>
            🎁 {t('levelComplete.bonus', { amount: GAME_CONFIG.levelBonusCapital })}
          </div>
        )}

        <button
          className="cb-btn-primary"
          style={{ width: '100%', marginTop: 10, fontSize: 16 }}
          onClick={onNext}
        >
          {isLastLevel
            ? `🏆 ${t('levelComplete.seeResults')}`
            : `🌿 ${t('levelComplete.nextLevel', { level: state.level + 1 })} →`}
        </button>
      </div>
    </div>
  );
}
