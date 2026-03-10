/* ──────────────────────────────────────────────────────────────
   Tutorial Overlay – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';

interface Props {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: Props) {
  const { t } = useTranslation('games');
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('nectar.tutorial.step1Title'),
      desc:  t('nectar.tutorial.step1Desc'),
      image: PICTURES.bgRunner,
    },
    {
      title: t('nectar.tutorial.step1bTitle'),
      desc:  t('nectar.tutorial.step1bDesc'),
      image: PICTURES.lirufJump,
    },
    {
      title: t('nectar.tutorial.step2Title'),
      desc:  t('nectar.tutorial.step2Desc'),
      image: PICTURES.stand,
    },
    {
      title: t('nectar.tutorial.step3Title'),
      desc:  t('nectar.tutorial.step3Desc'),
      image: PICTURES.customerHappy,
    },
    {
      title: t('nectar.tutorial.step4Title'),
      desc:  t('nectar.tutorial.step4Desc'),
      image: PICTURES.coin,
    },
  ];

  const current = steps[step];
  const isLast  = step === steps.length - 1;

  return (
    <div className="nectar-tutorial-overlay">
      <div className="nectar-tutorial-card">
        {/* Step indicator */}
        <div className="nectar-tutorial-dots">
          {steps.map((_, i) => (
            <span key={i} className={`nectar-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        {/* Image */}
        <div className="nectar-tutorial-img-wrap">
          <img src={current.image} alt="" className="nectar-tutorial-img" />
        </div>

        {/* Content */}
        <h2 className="nectar-tutorial-title">{current.title}</h2>
        <p  className="nectar-tutorial-desc">{current.desc}</p>

        {/* Navigation */}
        <div className="nectar-tutorial-nav">
          <button className="nectar-btn nectar-btn-ghost" onClick={onComplete}>
            {t('nectar.tutorial.skip')}
          </button>
          <button
            className="nectar-btn nectar-btn-primary"
            onClick={() => (isLast ? onComplete() : setStep(step + 1))}
          >
            {isLast ? t('nectar.tutorial.gotIt') : t('nectar.tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
