import { useTranslation } from 'react-i18next';
import type { BossPopupState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  popups: BossPopupState[];
  onClose: (id: string) => void;
}

// Fake popup content variants
const POPUP_VARIANTS = [
  { icon: '🏆', titleKey: 'hackerDefense:bossPopup.title1', bodyKey: 'hackerDefense:bossPopup.body1' },
  { icon: '💰', titleKey: 'hackerDefense:bossPopup.title2', bodyKey: 'hackerDefense:bossPopup.body2' },
  { icon: '🔔', titleKey: 'hackerDefense:bossPopup.title3', bodyKey: 'hackerDefense:bossPopup.body3' },
];

export default function BossPopupOverlay({ popups, onClose }: Props) {
  const { t } = useTranslation('games');

  return (
    <>
      {popups.map((popup, i) => {
        const variant = POPUP_VARIANTS[i % POPUP_VARIANTS.length];
        const timerPct = (popup.life / GAME_CONFIG.bossPopupLife) * 100;

        return (
          <div
            key={popup.id}
            className="hd-boss-popup"
            style={{
              left: `${popup.closeX}%`,
              top: `${popup.closeY}%`,
              transform: 'translate(-10%, -10%)',
            }}
          >
            {/* Close X button */}
            <button
              className="hd-boss-popup-close"
              onClick={() => onClose(popup.id)}
              title={t('hackerDefense:bossPopup.close')}
            >
              ×
            </button>

            {/* Timer bar (decreasing = auto-dismiss) */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: 3,
                width: timerPct + '%',
                background: '#ffc800',
                borderRadius: '0 0 0 10px',
                transition: 'width 0.1s linear',
              }}
            />

            <div className="hd-boss-popup-title">
              {variant.icon} {t(variant.titleKey)}
            </div>
            <div className="hd-boss-popup-body">{t(variant.bodyKey)}</div>
            <div
              style={{
                textAlign: 'center',
                background: 'rgba(255,200,0,0.2)',
                borderRadius: 8,
                padding: '4px 0',
                cursor: 'pointer',
                border: '1px solid rgba(255,200,0,0.4)',
                color: '#c84800',
                fontWeight: 900,
                fontSize: 12,
              }}
              onClick={() => onClose(popup.id)}
            >
              ❌ {t('hackerDefense:bossPopup.doNotClick')}
            </div>
          </div>
        );
      })}
    </>
  );
}
