import { useTranslation } from 'react-i18next';

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS = [
  { icon: '🏦', key: 'step1' },
  { icon: '🔐', key: 'step2' },
  { icon: '🦠', key: 'step3' },
  { icon: '⌨️', key: 'step4' },
];

export default function TutorialOverlay({ step, onNext, onSkip }: Props) {
  const { t } = useTranslation('games');
  const current = STEPS[step];

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 440, textAlign: 'center' }}>
        {/* Progress dots */}
        <div className="hd-tutorial-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`hd-tutorial-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div className="hd-tutorial-icon">{current.icon}</div>

        <div className="hd-title" style={{ fontSize: 18, marginBottom: 8 }}>
          {t(`hackerDefense:tutorial.${current.key}Title`)}
        </div>

        <div className="hd-tutorial-text">
          {t(`hackerDefense:tutorial.${current.key}Desc`)}
        </div>

        {/* Special visual hint per step */}
        {step === 1 && (
          <div className="flex gap-4 justify-center mb-4">
            {[
              { emoji: '🔐', label: t('hackerDefense:towers.password.name'), color: '#2d5db0' },
              { emoji: '🛡️', label: t('hackerDefense:towers.antivirus.name'), color: '#2d8040' },
              { emoji: '📱', label: t('hackerDefense:towers.wall2fa.name'), color: '#8040a0' },
            ].map((tower, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: tower.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {tower.emoji}
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
                  {tower.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-3 justify-center mb-4">
            {['🦠', '🐴', '🎭', '⚡', '🤵'].map((e, i) => (
              <span
                key={i}
                style={{
                  fontSize: 24,
                  filter: 'drop-shadow(0 0 6px rgba(255,100,100,0.5))',
                  animation: `hd-float ${1 + i * 0.15}s ease-in-out infinite alternate`,
                }}
              >
                {e}
              </span>
            ))}
          </div>
        )}

        {step === 3 && (
          <div
            className="mb-4 flex items-center justify-center gap-4"
            style={{
              background: 'rgba(255,220,0,0.08)',
              border: '1px solid rgba(255,220,0,0.3)',
              borderRadius: 12,
              padding: '10px 16px',
            }}
          >
            <span style={{ fontSize: 20 }}>⌨️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,220,0,0.9)', fontWeight: 700 }}>
                {t('hackerDefense:tutorial.spacebarHint')}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {t('hackerDefense:tutorial.actionCommandHint')}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={onSkip} className="hd-btn hd-btn-secondary" style={{ fontSize: 12, padding: '10px 18px' }}>
            {t('hackerDefense:tutorial.skip')}
          </button>
          <button onClick={onNext} className="hd-btn hd-btn-primary" style={{ padding: '10px 24px' }}>
            {step < STEPS.length - 1
              ? t('hackerDefense:tutorial.next')
              : t('hackerDefense:tutorial.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
