import { useTranslation } from 'react-i18next';
import { GAME_CONFIG } from '../constants';

interface Props {
  onDecline: () => void;
  onAccept: () => void;
  capital: number;
}

export default function PonziOverlay({ onDecline, onAccept, capital }: Props) {
  const { t } = useTranslation('chronoBloom');
  const canAfford = capital >= GAME_CONFIG.ponziCapitalCost;

  return (
    <div className="cb-overlay" style={{ zIndex: 55 }}>
      <div className="cb-ponzi-card">
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧙‍♂️</div>
        <div className="cb-ponzi-title">
          {t('ponzi.title')}
        </div>
        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 12,
          color: 'rgba(251,191,36,0.8)',
          margin: '8px 0 14px',
          lineHeight: 1.6,
        }}>
          {t('ponzi.offer', { cost: GAME_CONFIG.ponziCapitalCost })}
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10,
          padding: '8px 14px',
          margin: '8px 0',
          fontFamily: '"Nunito", sans-serif',
          fontSize: 11,
          color: 'rgba(251,191,36,0.6)',
          fontStyle: 'italic',
          textAlign: 'left',
        }}>
          ⚠️ {t('ponzi.hint')}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            className="cb-btn-secondary"
            style={{ flex: 1 }}
            onClick={onDecline}
          >
            🚫 {t('ponzi.decline')}
          </button>
          <button
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #78350f, #92400e)',
              border: '1px solid #f59e0b',
              borderRadius: 10,
              color: '#fbbf24',
              fontFamily: '"Nunito", sans-serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: canAfford ? 'pointer' : 'not-allowed',
              opacity: canAfford ? 1 : 0.5,
              padding: '8px 0',
            }}
            onClick={onAccept}
            disabled={!canAfford}
          >
            🌟 {t('ponzi.accept')}
          </button>
        </div>

        <p className="cb-ponzi-warning">
          {t('ponzi.portal')}
        </p>
      </div>
    </div>
  );
}
