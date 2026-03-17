import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const STEPS = [
  {
    icon: '👤',
    titleKey: 'paperCoin.tutorial.step1Title',
    descKey: 'paperCoin.tutorial.step1Desc',
    visual: (
      <div className="flex items-end justify-center gap-3 mt-2">
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-2xl bg-red-600 border-4 border-red-800 flex items-center justify-center text-3xl paper-character">
            ⚔️
          </div>
          <div className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Knight</div>
        </div>
        <div className="text-2xl">→</div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 border-4 border-purple-800 flex items-center justify-center text-3xl paper-character">
            🧙
          </div>
          <div className="bg-purple-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Wizard</div>
        </div>
        <div className="text-xl text-white/50">...</div>
      </div>
    ),
  },
  {
    icon: '🪙',
    titleKey: 'paperCoin.tutorial.step2Title',
    descKey: 'paperCoin.tutorial.step2Desc',
    visual: (
      <div className="flex flex-col items-center gap-2 mt-2">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="text-sm text-white/70 mb-1">🧪 Potion — 8 🪙</div>
          <div className="text-sm text-yellow-300 font-bold">Pays: 20 🪙</div>
          <div className="flex items-center gap-2 justify-center mt-1">
            <span className="text-white/60 text-sm">Change =</span>
            <span className="bg-green-500 text-white font-black px-3 py-0.5 rounded-lg">20 − 8 = 12</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: '⌨️',
    titleKey: 'paperCoin.tutorial.step3Title',
    descKey: 'paperCoin.tutorial.step3Desc',
    visual: (
      <div className="flex flex-col items-center gap-2 mt-2">
        <div className="grid grid-cols-3 gap-1.5">
          {['7','8','9','4','5','6','1','2','3','⌫','0','✓'].map((k) => (
            <div
              key={k}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
              style={{
                background: k === '✓' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : k === '⌫' ? '#f1f5f9' : '#fff',
                color: k === '✓' ? '#fff' : k === '⌫' ? '#64748b' : '#1e293b',
                boxShadow: k === '✓' ? '0 3px 0 #15803d' : '0 3px 0 #9ca3af',
              }}
            >
              {k}
            </div>
          ))}
        </div>
        <p className="text-white/70 text-xs text-center">
          Type your answer → press ✓
        </p>
      </div>
    ),
  },
];

export function TutorialOverlay({ state, dispatch }: Props) {
  const { t } = useTranslation('games');
  const step = state.tutorialStep;
  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-amber-900 to-amber-950 rounded-3xl border-2 border-amber-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-amber-800/60 px-5 py-3 flex items-center justify-between">
          <span className="text-amber-200 text-sm font-bold">
            {t('paperCoin.tutorial.title')} · {step + 1}/{STEPS.length}
          </span>
          <button
            className="text-amber-400 text-xs hover:text-white transition-colors"
            onClick={() => dispatch({ type: 'TUTORIAL_SKIP' })}
          >
            {t('paperCoin.tutorial.skip')} →
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 px-5 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 flex flex-col gap-3 pc-anim-fade-in" key={step}>
          <div className="text-4xl text-center">{current.icon}</div>
          <h3 className="pc-title-font text-xl text-yellow-300 text-center">
            {t(current.titleKey)}
          </h3>
          <p className="text-amber-100 text-sm text-center leading-relaxed">
            {t(current.descKey)}
          </p>
          {current.visual}
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            className="flex-1 py-3 rounded-xl pc-title-font text-lg text-white font-black transition-all duration-150 active:scale-95"
            style={{
              background: isLast
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: isLast
                ? '0 4px 0 #15803d'
                : '0 4px 0 #b45309',
            }}
            onClick={() => dispatch({ type: 'TUTORIAL_NEXT' })}
          >
            {isLast
              ? `⚔️ ${t('paperCoin.tutorial.startGame')}`
              : `${t('paperCoin.tutorial.next')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
