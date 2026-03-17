import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onKeyPress?: (key: string) => void;
}

const ROW_1 = ['7', '8', '9'];
const ROW_2 = ['4', '5', '6'];
const ROW_3 = ['1', '2', '3'];

export function NumericKeypad({ state, dispatch, onKeyPress }: Props) {
  const { t } = useTranslation('games');
  const isActive = state.phase === 'WAITING_INPUT';
  const hasInput = state.playerInput.length > 0;

  const pressKey = (key: string) => {
    if (!isActive) return;
    dispatch({ type: 'KEY_PRESS', key });
    onKeyPress?.(key);
  };

  const pressBackspace = () => {
    if (!isActive) return;
    dispatch({ type: 'KEY_BACKSPACE' });
  };

  const submitAnswer = () => {
    if (!isActive || !hasInput) return;
    dispatch({ type: 'SUBMIT_ANSWER' });
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto px-2">
      {/* Input display */}
      <div
        className={`pc-input-display flex items-center justify-center py-3 ${
          hasInput ? 'has-value' : ''
        }`}
      >
        <span
          className="text-white text-4xl font-black tracking-widest min-h-[2.5rem] flex items-center"
          style={{ fontFamily: 'Nunito, monospace' }}
        >
          {hasInput ? state.playerInput : (
            <span className="text-white/25 text-2xl font-bold">
              {isActive ? t('paperCoin.keypad.placeholder') : '—'}
            </span>
          )}
        </span>
        {hasInput && isActive && (
          <span className="ml-2 text-white/40 text-2xl animate-pulse">|</span>
        )}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-2">
        {[...ROW_1, ...ROW_2, ...ROW_3].map((key) => (
          <button
            key={key}
            className="pc-key-btn pc-key-num h-14"
            onClick={() => pressKey(key)}
            disabled={!isActive}
          >
            {key}
          </button>
        ))}

        {/* Bottom row: backspace, 0, submit */}
        <button
          className="pc-key-btn pc-key-backspace h-14"
          onClick={pressBackspace}
          disabled={!isActive}
        >
          ⌫
        </button>

        <button
          className="pc-key-btn pc-key-num h-14"
          onClick={() => pressKey('0')}
          disabled={!isActive}
        >
          0
        </button>

        <button
          className={`pc-key-btn h-14 ${
            hasInput && isActive ? 'pc-key-submit' : 'pc-key-submit-disabled'
          }`}
          onClick={submitAnswer}
          disabled={!isActive || !hasInput}
        >
          <span className="flex flex-col items-center leading-none">
            <span className="text-lg">✓</span>
            <span className="text-[9px] font-bold tracking-wide">
              {t('paperCoin.keypad.submit')}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
