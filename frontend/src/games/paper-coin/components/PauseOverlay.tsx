import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { useSound } from '@/contexts/SoundContext';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function PauseOverlay({ state, dispatch }: Props) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

  if (state.phase !== 'PAUSED') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-xs bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl border-2 border-white/10 shadow-2xl overflow-hidden pc-anim-pop-in">
        {/* Header */}
        <div className="px-5 py-5 text-center border-b border-white/10">
          <div className="text-4xl mb-2">⏸</div>
          <h2 className="pc-title-font text-2xl text-white">
            {t('paperCoin.pause.title')}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-white/60 text-sm">
              {t('paperCoin.hud.day', { day: state.day })}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-indigo-300 text-sm font-bold">
              {state.score} XP
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <button
            className="w-full py-3.5 rounded-xl pc-title-font text-lg font-black text-white transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 4px 0 #15803d',
            }}
            onClick={() => dispatch({ type: 'RESUME' })}
          >
            ▶ {t('paperCoin.pause.resume')}
          </button>

          <button
            className="w-full py-3 rounded-xl font-bold text-white/80 border border-white/15 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
            onClick={toggleMute}
          >
            {mute ? '🔇' : '🔊'}{' '}
            {mute
              ? t('paperCoin.pause.soundOff')
              : t('paperCoin.pause.soundOn')}
          </button>

          <button
            className="w-full py-3 rounded-xl font-bold text-blue-300/80 border border-blue-500/20 bg-blue-900/20 hover:bg-blue-900/30 transition-all active:scale-95"
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            🔄 {t('paperCoin.pause.restart')}
          </button>
        </div>
      </div>
    </div>
  );
}
