import { useTranslation } from 'react-i18next';
import type { InboxEmail } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  email: InboxEmail | null;
  timer: number;
  level: number;
  inboxDecision: 'phishing' | 'trust' | null;
  onPreviewDecide: (decision: 'phishing' | 'trust') => void;
}

export default function InboxPhase({ email, timer, level, inboxDecision, onPreviewDecide }: Props) {
  const { t } = useTranslation('games');

  if (!email) return null;

  const decided = inboxDecision !== null;

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 500 }}>
        {/* Header */}
        <div className="flex items-center gap-10 mb-4">
          <div style={{ fontSize: 32 }}>📬</div>
          <div>
            <div className="hd-title" style={{ fontSize: 16, textAlign: 'left', marginBottom: 2 }}>
              {t('hackerDefense:inbox.title')} — {t('hackerDefense:inbox.level', { level })}
            </div>
            <div className="hd-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
              {t('hackerDefense:inbox.subtitle')}
            </div>
          </div>
        </div>

        {/* Timer (CSS animation — depletes over inboxTimerTicks * tickMs ms) */}
        {!decided && (
          <div className="hd-inbox-timer">
            <span>⏱</span>
            <div className="hd-inbox-timer-bar">
              <div
                className="hd-inbox-timer-fill"
                style={{
                  width: '100%',
                  transition: `width ${(GAME_CONFIG.inboxTimerTicks * GAME_CONFIG.tickMs) / 1000}s linear`,
                  background: '#ffb400',
                  animationFillMode: 'forwards',
                }}
                ref={(el) => {
                  if (el) {
                    requestAnimationFrame(() => { el.style.width = '0%'; });
                  }
                }}
              />
            </div>
            <span style={{ minWidth: 28, textAlign: 'right' }}>
              {Math.ceil(GAME_CONFIG.inboxTimerTicks * GAME_CONFIG.tickMs / 1000)}s
            </span>
          </div>
        )}

        {/* Email */}
        <div className="hd-inbox-email">
          <div className="hd-inbox-from">
            {t('hackerDefense:inbox.from')}: <strong>{t(email.senderKey)}</strong>
          </div>
          <div className="hd-inbox-subject">{t(email.subjectKey)}</div>
          <div className="hd-inbox-body">{t(email.bodyKey)}</div>
          {email.linkKey && (
            <div className="hd-inbox-link">🔗 {t(email.linkKey)}</div>
          )}
        </div>

        {/* Result feedback */}
        {decided && (
          <div
            className="text-center mb-4 p-4 rounded-xl"
            style={{
              background: inboxDecision === (email.isPhishing ? 'phishing' : 'trust')
                ? 'rgba(0,255,120,0.1)'
                : 'rgba(255,68,68,0.1)',
              border: `1px solid ${
                inboxDecision === (email.isPhishing ? 'phishing' : 'trust')
                  ? 'rgba(0,255,120,0.3)'
                  : 'rgba(255,68,68,0.3)'
              }`,
              animation: 'hd-pop-in 0.3s ease-out',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>
              {inboxDecision === (email.isPhishing ? 'phishing' : 'trust') ? '✅' : '❌'}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: inboxDecision === (email.isPhishing ? 'phishing' : 'trust')
                  ? '#00ff78'
                  : '#ff4444',
                marginBottom: 6,
              }}
            >
              {inboxDecision === (email.isPhishing ? 'phishing' : 'trust')
                ? t('hackerDefense:inbox.correct')
                : t('hackerDefense:inbox.wrong')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {t(email.explainKey)}
            </div>
            {inboxDecision === (email.isPhishing ? 'phishing' : 'trust') && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 13,
                  color: '#64a0ff',
                  fontWeight: 700,
                }}
              >
                +{GAME_CONFIG.inboxBonus} {t('hackerDefense:hud.data')} 🎁
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!decided && (
          <div className="hd-inbox-buttons">
            <button className="hd-phishing-btn" onClick={() => onPreviewDecide('phishing')}>
              🚫 {t('hackerDefense:inbox.isPhishing')}
            </button>
            <button className="hd-trust-btn" onClick={() => onPreviewDecide('trust')}>
              ✅ {t('hackerDefense:inbox.trust')}
            </button>
          </div>
        )}

        {decided && (
          <div className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            {t('hackerDefense:inbox.starting')}...
          </div>
        )}
      </div>
    </div>
  );
}
