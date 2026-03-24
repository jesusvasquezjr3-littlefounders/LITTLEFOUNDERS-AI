import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onPlayAgain: () => void;
}

function getOverallStars(state: GameState): number {
  const allYearStats = state.allStats.flat();
  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const totalInterest = allYearStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalStolen = allYearStats.reduce((s, y) => s + y.capitalStolenByEnemies, 0);
  if (hpPct >= 0.6 && state.liquidatedEarly === 0 && totalStolen < 200) return 3;
  if (hpPct >= 0.3 && totalInterest > 0) return 2;
  return 1;
}

export default function VictoryScreen({ state, onPlayAgain }: Props) {
  const { t } = useTranslation('chronoBloom');
  const stars = getOverallStars(state);

  const allYearStats = state.allStats.flat();
  const totalInterest = allYearStats.reduce((s, y) => s + y.interestEarned, 0);
  const totalEnemies = allYearStats.reduce((s, y) => s + y.enemiesDefeated, 0);
  const totalStolen = allYearStats.reduce((s, y) => s + y.capitalStolenByEnemies, 0);
  const goldTrees = state.plants.filter(p => p.isGolden).length;

  // Compound interest education: what would have happened with no investment
  const initialCapital = 500;
  const compoundGrowth = state.capital;
  const flatGrowth = initialCapital;

  return (
    <div className="cb-overlay">
      <div className="cb-victory-card">
        {/* Celebration header */}
        <div style={{ fontSize: 44, marginBottom: 4, letterSpacing: 4 }}>
          🌳 💰 🌳
        </div>
        <div className="cb-victory-title">
          {t('victory.title')}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 13,
          color: 'rgba(134,239,172,0.75)',
          margin: '4px 0 16px',
          lineHeight: 1.6,
        }}>
          {t('victory.subtitle')}
        </p>

        {/* Stars */}
        <div className="cb-stars">
          {[1, 2, 3].map(s => (
            <span key={s} className={`cb-star ${s <= stars ? 'lit' : ''}`}>⭐</span>
          ))}
        </div>

        {/* Wealth Score */}
        <div style={{
          background: 'rgba(255,215,0,0.1)',
          border: '2px solid rgba(255,215,0,0.4)',
          borderRadius: 14,
          padding: '14px 20px',
          margin: '14px 0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: '"Orbitron", monospace',
              fontSize: 8,
              color: 'rgba(255,215,0,0.6)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              {t('victory.finalWealth')}
            </div>
            <div style={{
              fontFamily: '"Orbitron", monospace',
              fontSize: 28,
              fontWeight: 900,
              color: '#ffd700',
              textShadow: '0 0 20px rgba(255,215,0,0.6)',
            }}>
              ${state.capital.toLocaleString()}
            </div>
          </div>
          <div style={{ color: 'rgba(255,215,0,0.4)', fontSize: 24 }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: '"Orbitron", monospace',
              fontSize: 8,
              color: 'rgba(134,239,172,0.5)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              {t('victory.noInvestment')}
            </div>
            <div style={{
              fontFamily: '"Orbitron", monospace',
              fontSize: 22,
              color: 'rgba(134,239,172,0.5)',
              textDecoration: 'line-through',
            }}>
              ${flatGrowth}
            </div>
          </div>
        </div>

        {/* KPI stats */}
        <div className="cb-score-board">
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('victory.totalInterest')}</div>
            <div className="cb-score-item-value gold">+${totalInterest}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('victory.enemiesDefeated')}</div>
            <div className="cb-score-item-value">{totalEnemies}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('victory.capitalLost')}</div>
            <div className="cb-score-item-value orange">${totalStolen}</div>
          </div>
          <div className="cb-score-item">
            <div className="cb-score-item-label">{t('victory.score')}</div>
            <div className="cb-score-item-value gold">{state.score}</div>
          </div>
        </div>

        {/* HODL achievement */}
        {goldTrees > 0 && (
          <div style={{
            background: 'rgba(255,215,0,0.12)',
            border: '1px solid rgba(255,215,0,0.4)',
            borderRadius: 10,
            padding: '8px 14px',
            margin: '10px 0',
            fontFamily: '"Nunito", sans-serif',
            fontSize: 12,
            color: '#ffd700',
          }}>
            👑 {t('victory.hodlAchievement', { count: goldTrees })}
          </div>
        )}

        {/* Education message */}
        <div style={{
          background: 'rgba(74,222,128,0.08)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 10,
          padding: '10px 14px',
          margin: '10px 0',
          fontFamily: '"Nunito", sans-serif',
          fontSize: 11,
          color: 'rgba(134,239,172,0.8)',
          lineHeight: 1.5,
        }}>
          📚 {t('victory.lesson')}
        </div>

        {state.score > state.highScore && (
          <div style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 12,
            color: '#ffd700',
            margin: '8px 0',
            animation: 'cb-pulse-warn 0.8s infinite alternate',
          }}>
            🏆 {t('victory.newRecord')}!
          </div>
        )}

        <button
          className="cb-btn-primary"
          style={{ width: '100%', marginTop: 12, fontSize: 16 }}
          onClick={onPlayAgain}
        >
          🌱 {t('victory.playAgain')}
        </button>
      </div>
    </div>
  );
}
