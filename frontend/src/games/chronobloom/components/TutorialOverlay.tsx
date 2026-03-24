import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    titleKey: 'tutorial.step0.title',
    descKey: 'tutorial.step0.desc',
    emoji: '🌱',
    zelda: true,
  },
  {
    titleKey: 'tutorial.step1.title',
    descKey: 'tutorial.step1.desc',
    emoji: '📅',
    zelda: false,
  },
  {
    titleKey: 'tutorial.step2.title',
    descKey: 'tutorial.step2.desc',
    emoji: '💰',
    zelda: false,
  },
  {
    titleKey: 'tutorial.step3.title',
    descKey: 'tutorial.step3.desc',
    emoji: '⚠️',
    zelda: false,
  },
];

export default function TutorialOverlay({ state, onNext, onSkip }: Props) {
  const { t } = useTranslation('chronoBloom');
  const step = STEPS[state.tutorialStep] || STEPS[0];
  const isLast = state.tutorialStep >= STEPS.length - 1;

  return (
    <div className="cb-overlay">
      <div className="cb-card" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{step.emoji}</div>
        <div className="cb-tutorial-step">
          {t('tutorial.stepLabel', { current: state.tutorialStep + 1, total: STEPS.length })}
        </div>
        <div className="cb-card-title" style={{ fontSize: 24 }}>
          {t(step.titleKey)}
        </div>
        <p className="cb-card-subtitle">
          {t(step.descKey)}
        </p>

        {/* Zelda easter egg on step 0 */}
        {step.zelda && (
          <div style={{
            background: 'rgba(255,215,0,0.1)',
            border: '1px solid rgba(255,215,0,0.3)',
            borderRadius: 10,
            padding: '8px 14px',
            marginBottom: 18,
            fontFamily: '"Nunito", sans-serif',
            fontSize: 11,
            color: '#fbbf24',
            fontStyle: 'italic',
          }}>
            👴 {t('tutorial.zelda')}
          </div>
        )}

        <div className="cb-tutorial-steps-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`cb-tutorial-dot ${i === state.tutorialStep ? 'active' : ''}`} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
          <button className="cb-btn-secondary" onClick={onSkip}>
            {t('tutorial.skip')}
          </button>
          <button className="cb-btn-primary" style={{ fontSize: 15 }} onClick={onNext}>
            {isLast ? `🌱 ${t('tutorial.start')}` : `${t('tutorial.next')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
