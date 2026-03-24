import { useTranslation } from 'react-i18next';
import type { GameState, PlantType } from '../types';
import { PLANT_DEFS } from '../constants';

interface Props {
  state: GameState;
  onContinue: () => void;
}

function plantEmoji(type: PlantType) {
  return PLANT_DEFS[type].emoji;
}

export default function YearResultScreen({ state, onContinue }: Props) {
  const { t } = useTranslation('chronoBloom');
  const data = state.yearResultData;
  if (!data) return null;

  // Growth chart: show compound interest curve vs flat savings
  const years = state.year;
  const baseInvested = data.interestBreakdown
    .filter(b => !b.disappeared)
    .reduce((sum, b) => sum + b.oldValue, 0);

  const chartPoints = Array.from({ length: years + 1 }, (_, i) => ({
    year: i,
    compound: Math.floor(baseInvested * Math.pow(1.07, i)),
    flat: baseInvested,
  }));

  const maxVal = Math.max(...chartPoints.map(p => p.compound)) * 1.1;
  const chartW = 400, chartH = 60;

  return (
    <div className="cb-overlay">
      <div className="cb-result-card">
        <div className="cb-result-title">
          📅 {t('yearResult.title', { year: state.year, level: state.level })}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 12,
          color: 'rgba(134,239,172,0.6)',
          margin: '4px 0 12px',
        }}>
          {t('yearResult.subtitle')}
        </p>

        {/* Bear market warning */}
        {data.bearMarketOccurred && (
          <div className="cb-result-bear">
            <span>📉</span>
            <span>{t('yearResult.bearMarket')}</span>
          </div>
        )}

        {/* Interest breakdown */}
        <div style={{ marginBottom: 12 }}>
          {data.interestBreakdown.map(row => (
            <div
              key={row.plantId}
              className={`cb-result-interest-row ${row.bearMarket ? 'bear-hit' : ''} ${row.isGolden ? 'golden' : ''}`}
            >
              <span className="emoji">{plantEmoji(row.plantType)}</span>
              {row.disappeared ? (
                <>
                  <span style={{ color: 'rgba(134,239,172,0.5)', fontStyle: 'italic' }}>
                    {t('yearResult.cactusDisappeared')}
                  </span>
                </>
              ) : (
                <>
                  <span className="old-val">${row.oldValue}</span>
                  <span className="arrow">→</span>
                  <span className="new-val">${row.newValue}</span>
                  {row.bearMarket && <span style={{ fontSize: 11, color: '#fb923c' }}>📉</span>}
                  {row.isGolden && <span title={t('yearResult.hodlAchievement')}>👑</span>}
                  <span className="earned">
                    {row.interestEarned >= 0 ? '+' : ''}{row.interestEarned < 0 ? '' : '$'}{row.interestEarned}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Total interest earned */}
        <div className="cb-result-total">
          <div>
            <div className="label">{t('yearResult.capitalBefore')}</div>
            <div style={{ color: 'rgba(74,222,128,0.6)', fontSize: 12 }}>${data.capitalBefore}</div>
          </div>
          <div style={{ color: 'rgba(74,222,128,0.4)', fontSize: 18 }}>→</div>
          <div>
            <div className="label">{t('yearResult.interestEarned')}</div>
            <div className="value" style={{ fontSize: 15 }}>
              +${data.totalInterestEarned}
            </div>
          </div>
          <div style={{ color: 'rgba(74,222,128,0.4)', fontSize: 18 }}>→</div>
          <div>
            <div className="label">{t('yearResult.totalCapital')}</div>
            <div className="value">${data.capitalAfter}</div>
          </div>
        </div>

        {/* Compound interest growth chart */}
        {years > 1 && (
          <>
            <p style={{
              fontFamily: '"Orbitron", monospace',
              fontSize: 9,
              color: 'rgba(74,222,128,0.5)',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              margin: '14px 0 4px',
            }}>
              {t('yearResult.growthChart')}
            </p>
            <div className="cb-graph-container">
              <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                {/* Flat line (no interest) */}
                <polyline
                  className="cb-graph-line-baseline"
                  points={chartPoints.map((p, i) =>
                    `${(i / (chartPoints.length - 1)) * chartW},${chartH - (p.flat / maxVal) * chartH}`
                  ).join(' ')}
                />
                {/* Compound line */}
                <polyline
                  className="cb-graph-line"
                  points={chartPoints.map((p, i) =>
                    `${(i / (chartPoints.length - 1)) * chartW},${chartH - (p.compound / maxVal) * chartH}`
                  ).join(' ')}
                />
              </svg>
            </div>
            <div className="cb-graph-legend">
              <div className="cb-graph-legend-item">
                <div className="cb-graph-legend-dot" style={{ background: '#4ade80' }} />
                {t('yearResult.compoundLine')}
              </div>
              <div className="cb-graph-legend-item">
                <div className="cb-graph-legend-dot" style={{ background: 'rgba(156,163,175,0.5)' }} />
                {t('yearResult.flatLine')}
              </div>
            </div>
          </>
        )}

        {/* KPI: Opportuniy cost warning if liquidated early */}
        {state.liquidatedEarly > 0 && (
          <div style={{
            background: 'rgba(251,146,60,0.1)',
            border: '1px solid rgba(251,146,60,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            margin: '10px 0',
            fontFamily: '"Nunito", sans-serif',
            fontSize: 11,
            color: '#fb923c',
          }}>
            💸 {t('yearResult.earlySellWarning', { count: state.liquidatedEarly })}
          </div>
        )}

        <button
          className="cb-btn-primary"
          style={{ width: '100%', marginTop: 14, fontSize: 15 }}
          onClick={onContinue}
        >
          {t('yearResult.continue', { nextYear: state.year + 1 })} →
        </button>
      </div>
    </div>
  );
}
