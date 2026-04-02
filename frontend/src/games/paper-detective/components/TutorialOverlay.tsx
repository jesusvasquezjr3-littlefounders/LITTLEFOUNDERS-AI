import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, ITEM_EMOJI, COIN_EMOJI } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  { key: 'step1', emoji: '🔍', imgKey: 'detective' as const },
  { key: 'step2', emoji: '🪙', imgKey: null },
  { key: 'step3', emoji: '🐷', imgKey: 'piggyBank' as const },
  { key: 'step4', emoji: '⏱️', imgKey: null },
];

export function TutorialOverlay({ onComplete, onSkip }: Props) {
  const { t } = useTranslation('games');
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="absolute inset-0 pd-bg flex flex-col items-center justify-center pd-font p-4">
      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${i === step ? 'bg-amber-700 border-amber-900 scale-125' : i < step ? 'bg-amber-400 border-amber-600' : 'bg-amber-200 border-amber-400'}`}
          />
        ))}
      </div>

      {/* Card */}
      <div className="pd-card w-full max-w-sm p-6 text-center mb-6 pd-slide-up">
        {/* Illustration */}
        <div className="mb-4 flex items-center justify-center" style={{ height: '120px' }}>
          {current.imgKey ? (
            <AssetImg
              assetPath={PICTURES[current.imgKey]}
              alt=""
              className="h-full object-contain drop-shadow-md"
              draggable={false}
            />
          ) : (
            <span className="text-7xl">{current.emoji}</span>
          )}
        </div>

        {/* Phase 1 step: show a mini demo */}
        {step === 1 && (
          <div className="mb-3">
            <div className="pd-price-tag inline-block px-4 py-2 mb-3">
              <span className="text-2xl font-black text-amber-900">$5</span>
            </div>
            <div className="flex justify-center gap-3 mt-2">
              {['coin1', 'coin2', 'coin5', 'pokerChip'].map((key, i) => (
                <div
                  key={key}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-4 ${i === 2 ? 'border-green-500 bg-green-100' : 'border-amber-300 bg-amber-50'}`}
                >
                  {COIN_EMOJI[key]}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 2 step: show a mini vault demo */}
        {step === 2 && (
          <div className="mb-3">
            <div className="pd-piggy-display inline-block px-4 py-2 rounded-lg font-mono text-green-400 mb-2">
              $7 / $7 ✓
            </div>
            <div className="flex justify-center gap-2 mt-2">
              {['coin5', 'coin2'].map(key => (
                <div key={key} className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-3 border-green-400 bg-green-50">
                  {COIN_EMOJI[key]}
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-black text-amber-900 mb-2">
          {t(`paperDetective.tutorial.${current.key}Title`)}
        </h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          {t(`paperDetective.tutorial.${current.key}Desc`)}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onSkip}
          className="pd-btn flex-1 py-3 text-sm font-bold text-amber-700"
        >
          {t('paperDetective.tutorial.skip')}
        </button>
        <button
          onClick={handleNext}
          className="pd-btn pd-btn-primary flex-2 py-3 text-sm font-bold"
          style={{ flex: 2 }}
        >
          {isLast
            ? t('paperDetective.tutorial.gotIt')
            : t('paperDetective.tutorial.next')}
        </button>
      </div>
    </div>
  );
}
