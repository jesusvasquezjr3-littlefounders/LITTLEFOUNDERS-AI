import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameStartScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900 via-amber-800 to-amber-950" />
      <div className="absolute inset-0 opacity-20">
        {/* Decorative torches */}
        <div className="absolute top-8 left-6 text-4xl animate-pulse">🔦</div>
        <div className="absolute top-8 right-6 text-4xl animate-pulse" style={{ animationDelay: '0.5s' }}>🔦</div>
        <div className="absolute bottom-24 left-4 text-3xl opacity-60">⚗️</div>
        <div className="absolute bottom-24 right-4 text-3xl opacity-60">⚗️</div>
      </div>

      {/* Floating coins background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['🪙', '💰', '🪙', '💰', '🪙'].map((coin, i) => (
          <div
            key={i}
            className="absolute text-2xl opacity-20"
            style={{
              left: `${15 + i * 18}%`,
              top: `${20 + (i % 3) * 20}%`,
              animation: `pcBounce ${2 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            {coin}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-sm mx-auto">
        {/* Sign */}
        <div className="pc-anim-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-amber-900/80 border-4 border-amber-600 rounded-2xl px-6 py-2 mb-1">
            <p className="pc-title-font text-amber-200 text-xs tracking-widest uppercase">
              {t('paperCoin.startScreen.shopSign')}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center pc-anim-fade-in" style={{ animationDelay: '0.2s' }}>
          <h1 className="pc-title-font pc-start-title text-4xl md:text-5xl text-yellow-300 leading-tight">
            {t('paperCoin.title')}
          </h1>
          <p className="text-amber-200 text-sm mt-2 font-bold opacity-80">
            {t('paperCoin.subtitle')}
          </p>
        </div>

        {/* High Score */}
        {state.highScore > 0 && (
          <div className="pc-anim-pop-in" style={{ animationDelay: '0.35s' }}>
            <div className="bg-black/30 border border-yellow-400/40 rounded-xl px-5 py-2 text-center">
              <span className="text-yellow-300 text-xs font-bold uppercase tracking-wider">
                🏆 {t('paperCoin.startScreen.highScore', { score: state.highScore })}
              </span>
            </div>
          </div>
        )}

        {/* Character preview */}
        <div className="pc-anim-pop-in flex gap-3" style={{ animationDelay: '0.4s' }}>
          {['⚔️', '🧙', '🥷', '🏹', '💙', '🎵'].map((emoji, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center text-xl"
              style={{ animationDelay: `${0.5 + i * 0.08}s` }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3 pc-anim-fade-in" style={{ animationDelay: '0.5s' }}>
          <button
            className="w-full py-4 rounded-2xl pc-title-font text-xl font-black text-white shadow-xl transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 5px 0 #15803d, 0 8px 20px rgba(34, 197, 94, 0.4)',
            }}
            onClick={() => dispatch({ type: 'START_PLAYING' })}
          >
            ⚔️ {t('paperCoin.startScreen.playButton')}
          </button>

          <button
            className="w-full py-3 rounded-2xl text-base font-bold text-amber-200 border-2 border-amber-500/50 bg-black/20 hover:bg-black/30 transition-all duration-150 active:scale-95"
            onClick={() => dispatch({ type: 'GO_TO_TUTORIAL' })}
          >
            📖 {t('paperCoin.startScreen.howToPlay')}
          </button>
        </div>

        {/* Footer */}
        <p className="text-amber-400/50 text-xs text-center pc-anim-fade-in" style={{ animationDelay: '0.7s' }}>
          {t('paperCoin.startScreen.footerHint')}
        </p>
      </div>
    </div>
  );
}
