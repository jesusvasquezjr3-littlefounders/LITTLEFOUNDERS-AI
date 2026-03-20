import { useTranslation } from 'react-i18next';
import type { TwoFAState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  twoFA: TwoFAState;
  onType: (char: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'];

export default function TwoFAPrompt({ twoFA, onType, onSubmit, onCancel }: Props) {
  const { t } = useTranslation('games');

  const timerPct = (twoFA.timeLeft / GAME_CONFIG.twoFATimeoutTicks) * 100;
  const inputDisplay = twoFA.inputCode.padEnd(4, '•');

  const handleKey = (k: string) => {
    if (k === '←') {
      // backspace: re-type without last char
      if (twoFA.inputCode.length > 0) {
        onType('BACKSPACE' as string);
      }
    } else if (k === '✓') {
      onSubmit();
    } else {
      if (twoFA.inputCode.length < 4) {
        onType(k);
      }
    }
  };

  return (
    <div className="hd-2fa-overlay">
      <div className="hd-2fa-card">
        {/* Header */}
        <div style={{ fontSize: 36, marginBottom: 4 }}>📱</div>
        <div className="hd-2fa-title">{t('hackerDefense:twoFA.title')}</div>
        <div style={{ fontSize: 11, color: 'rgba(200,100,255,0.7)', marginBottom: 10, lineHeight: 1.4 }}>
          {t('hackerDefense:twoFA.subtitle')}
        </div>

        {/* Timer bar */}
        <div className="hd-2fa-timer">
          <div
            className="hd-2fa-timer-fill"
            style={{
              width: timerPct + '%',
              background: timerPct < 30 ? '#ff4444' : 'linear-gradient(90deg,#ff4444,#ffb400)',
            }}
          />
        </div>

        {/* Code to type */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
          {t('hackerDefense:twoFA.code')}:
        </div>
        <div className="hd-2fa-code-display">{twoFA.code}</div>

        {/* Input display */}
        <div className="hd-2fa-input-display">{inputDisplay}</div>

        {/* Keypad */}
        <div className="hd-2fa-keypad">
          {KEYS.map(k => (
            <button
              key={k}
              className="hd-2fa-key"
              onClick={() => handleKey(k)}
              style={
                k === '✓'
                  ? { background: 'rgba(0,200,100,0.2)', borderColor: 'rgba(0,200,100,0.4)', color: '#00ff78' }
                  : k === '←'
                  ? { background: 'rgba(255,100,100,0.1)', borderColor: 'rgba(255,100,100,0.3)' }
                  : {}
              }
            >
              {k}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          {t('hackerDefense:twoFA.skip')}
        </button>
      </div>
    </div>
  );
}
