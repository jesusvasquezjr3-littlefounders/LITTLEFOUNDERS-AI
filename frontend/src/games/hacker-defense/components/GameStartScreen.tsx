import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onStart: () => void;
}

export default function GameStartScreen({ state, onStart }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="hd-start-bg">
      {/* Animated background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-green-500 opacity-10"
            style={{
              width: 2 + Math.random() * 4 + 'px',
              height: 2 + Math.random() * 4 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `hd-float ${1.5 + Math.random() * 2}s ease-in-out infinite alternate`,
              animationDelay: Math.random() * 2 + 's',
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="text-center relative z-10">
        <div className="hd-logo-glow" style={{ fontSize: 38 }}>
          {t('hackerDefense:start.title')}
        </div>
        <div className="hd-logo-sub mt-2">{t('hackerDefense:start.subtitle')}</div>
      </div>

      {/* Enemy preview */}
      <div className="hd-enemy-preview relative z-10">
        {['🦠', '🐴', '🎭', '⚡', '🤵'].map((emoji, i) => (
          <span
            key={i}
            style={{
              fontSize: 28,
              filter: 'drop-shadow(0 0 8px rgba(255,100,100,0.5))',
              animationDelay: i * 0.1 + 's',
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* High Score */}
      {state.highScore > 0 && (
        <div
          className="relative z-10 text-center"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            color: 'rgba(200,100,255,0.8)',
            letterSpacing: 2,
          }}
        >
          ★ {t('hackerDefense:start.highScore')}: {state.highScore.toLocaleString()} ★
        </div>
      )}

      {/* Tower preview */}
      <div className="relative z-10 flex gap-6 items-center justify-center">
        {['🔐', '🛡️', '📱'].map((emoji, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2"
            style={{ animation: `hd-float ${1.2 + i * 0.3}s ease-in-out infinite alternate` }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: [
                  'linear-gradient(135deg,#1a3a6b,#2d5db0)',
                  'linear-gradient(135deg,#1a4a2a,#2d8040)',
                  'linear-gradient(135deg,#4a1a4a,#8040a0)',
                ][i],
                border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              {emoji}
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
              {[
                t('hackerDefense:towers.password.name'),
                t('hackerDefense:towers.antivirus.name'),
                t('hackerDefense:towers.wall2fa.name'),
              ][i]}
            </span>
          </div>
        ))}
      </div>

      {/* Play Button */}
      <button
        onClick={onStart}
        className="hd-btn hd-btn-primary relative z-10"
        style={{ fontSize: 16, padding: '16px 48px', letterSpacing: 3 }}
      >
        {t('hackerDefense:start.playButton')}
      </button>

      {/* Keyboard hint */}
      <div
        className="relative z-10 text-center"
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}
      >
        {t('hackerDefense:start.spaceHint')}
      </div>
    </div>
  );
}
