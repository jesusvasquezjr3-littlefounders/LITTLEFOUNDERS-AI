import { useTranslation } from 'react-i18next';

interface Props {
  onResume: () => void;
  onRestart: () => void;
}

export default function PauseOverlay({ onResume, onRestart }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏸</div>
        <div className="hd-title" style={{ fontSize: 20, marginBottom: 6 }}>
          {t('hackerDefense:pause.title')}
        </div>
        <div className="hd-subtitle">{t('hackerDefense:pause.subtitle')}</div>

        <div className="flex flex-col gap-3 mt-4">
          <button onClick={onResume} className="hd-btn hd-btn-primary" style={{ width: '100%' }}>
            ▶ {t('hackerDefense:pause.resume')}
          </button>
          <button
            onClick={onRestart}
            className="hd-btn hd-btn-secondary"
            style={{ width: '100%', fontSize: 12 }}
          >
            {t('hackerDefense:pause.restart')}
          </button>
        </div>

        {/* Keyboard shortcuts reminder */}
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'left',
            lineHeight: 1.8,
          }}
        >
          <div>
            <strong style={{ color: 'rgba(255,255,255,0.6)' }}>SPACE</strong>{' '}
            → {t('hackerDefense:pause.spaceHint')}
          </div>
          <div>
            <strong style={{ color: 'rgba(255,255,255,0.6)' }}>ESC</strong>{' '}
            → {t('hackerDefense:pause.escHint')}
          </div>
          <div>
            <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Click</strong>{' '}
            → {t('hackerDefense:pause.clickHint')}
          </div>
        </div>
      </div>
    </div>
  );
}
