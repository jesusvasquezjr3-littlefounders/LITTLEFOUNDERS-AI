import { useTranslation } from 'react-i18next';

interface Props {
  onResume: () => void;
  onRestart: () => void;
}

export default function PauseOverlay({ onResume, onRestart }: Props) {
  const { t } = useTranslation('chronoBloom');

  return (
    <div className="cb-overlay">
      <div className="cb-pause-card">
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏸</div>
        <div className="cb-card-title">{t('pause.title')}</div>
        <p className="cb-card-subtitle">{t('pause.subtitle')}</p>

        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(74,222,128,0.15)',
          borderRadius: 10,
          padding: '10px 16px',
          margin: '12px 0',
          fontFamily: '"Nunito", sans-serif',
          fontSize: 11,
          color: 'rgba(134,239,172,0.6)',
          textAlign: 'left',
          lineHeight: 1.8,
        }}>
          <div>🖱️ {t('pause.hintClick')}</div>
          <div>💰 {t('pause.hintCollect')}</div>
          <div>📅 {t('pause.hintAdvance')}</div>
          <div>💸 {t('pause.hintLiquidate')}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <button className="cb-btn-primary" style={{ fontSize: 16 }} onClick={onResume}>
            ▶ {t('pause.resume')}
          </button>
          <button className="cb-btn-secondary" onClick={onRestart}>
            🔄 {t('pause.restart')}
          </button>
        </div>
      </div>
    </div>
  );
}
