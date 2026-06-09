import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';
import { ArrowDown, Heart } from 'lucide-react';

interface TutorialOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ onComplete, onSkip }: TutorialOverlayProps) {
  const { t } = useTranslation('games');
  const [step, setStep] = useState(0);

  const totalSteps = 3;

  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6 bg-black/90 backdrop-blur-sm relative">
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-4 right-4 pixel-font text-[8px] text-white/50 hover:text-white/80 transition-colors"
      >
        {t('namVsYum.tutorial.skip')}
      </button>

      {/* Step content */}
      <div className="flex flex-col items-center gap-6 max-w-sm w-full animate-bounce-in" key={step}>
        {step === 0 && (
          <>
            <h2 className="pixel-font text-sm sm:text-base text-white retro-glow text-center">
              {t('namVsYum.tutorial.step1Title')}
            </h2>
            <div className="flex items-center gap-6 sm:gap-10">
              {/* Vitalio */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-b from-green-600 to-green-800 rounded-xl flex items-center justify-center">
                  <AssetImg assetPath={PICTURES.vitalio} alt="" className="w-full h-full object-contain pixel-art p-1" draggable={false} fallback={<span className="text-4xl">🦎</span>} />
                </div>
                <span className="pixel-font text-[8px] sm:text-[10px] text-green-300">{t('namVsYum.tutorial.vitalioLabel')}</span>
                <span className="text-[10px] sm:text-xs text-green-200 text-center">{t('namVsYum.tutorial.vitalioDesc')}</span>
              </div>

              {/* Capricho */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-b from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
                  <AssetImg assetPath={PICTURES.capricho} alt="" className="w-full h-full object-contain pixel-art p-1" draggable={false} fallback={<span className="text-4xl">👾</span>} />
                </div>
                <span className="pixel-font text-[8px] sm:text-[10px] text-purple-300">{t('namVsYum.tutorial.caprichoLabel')}</span>
                <span className="text-[10px] sm:text-xs text-purple-200 text-center">{t('namVsYum.tutorial.caprichoDesc')}</span>
              </div>
            </div>
            <p className="text-sm text-white/80 text-center">{t('namVsYum.tutorial.step1Desc')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="pixel-font text-sm sm:text-base text-white retro-glow text-center">
              {t('namVsYum.tutorial.step2Title')}
            </h2>
            {/* Animated demo */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Falling item animation */}
              <div className="absolute top-0 animate-slide-down">
                <div className="w-12 h-12 bg-slate-800/80 border-2 border-slate-600 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🍎</span>
                </div>
              </div>
              <ArrowDown className="w-8 h-8 text-white/40 animate-bounce mt-8" />
              {/* Monster at bottom */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-b from-green-600 to-green-800 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🦎</span>
              </div>
            </div>
            <p className="text-sm text-white/80 text-center">{t('namVsYum.tutorial.step2Desc')}</p>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="pixel-font text-sm sm:text-base text-white retro-glow text-center">
              {t('namVsYum.tutorial.step3Title')}
            </h2>
            {/* Hearts display */}
            <div className="flex gap-3 my-4">
              <Heart className="w-10 h-10 fill-red-500 text-red-500" />
              <Heart className="w-10 h-10 fill-red-500 text-red-500" />
              <Heart className="w-10 h-10 fill-gray-700 text-gray-700" />
            </div>
            <p className="text-sm text-white/80 text-center">{t('namVsYum.tutorial.step3Desc')}</p>
          </>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mt-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              i === step ? 'bg-white scale-110' : 'bg-white/30',
            )}
          />
        ))}
      </div>

      {/* Next / Got it button */}
      <button
        onClick={nextStep}
        className={cn(
          'pixel-font text-xs sm:text-sm mt-6 px-8 py-3',
          'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600',
          'text-white rounded-lg border-b-4 border-cyan-700',
          'hover:border-cyan-500 active:border-b-0 active:mt-7',
          'transition-all duration-100',
        )}
      >
        {step < totalSteps - 1 ? t('namVsYum.tutorial.next') : t('namVsYum.tutorial.gotIt')}
      </button>

      {/* Drag instruction blinking text */}
      <p className="pixel-font text-[7px] sm:text-[8px] text-indigo-300/70 text-center mt-4 blink-text whitespace-pre-line">
        {t('namVsYum.tutorial.dragInstruction')}
      </p>
    </div>
  );
}
