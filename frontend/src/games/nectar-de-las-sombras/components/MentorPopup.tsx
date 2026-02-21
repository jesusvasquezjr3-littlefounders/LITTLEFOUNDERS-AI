/* ──────────────────────────────────────────────────────────────
   Mentor Popup – Character dialogue box
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import type { MentorTip, MentorCharacter } from '../types';

interface Props {
  tip: MentorTip;
  onDismiss: () => void;
}

const MENTOR_PICS: Record<MentorCharacter, string> = {
  drRho: PICTURES.drRho,
  zara: PICTURES.zara,
  liruf: PICTURES.liruf,
  dina: PICTURES.dina,
};

export function MentorPopup({ tip, onDismiss }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="nectar-mentor-popup" onClick={onDismiss}>
      <div className="nectar-mentor-bubble">
        <img
          src={MENTOR_PICS[tip.character]}
          alt={t(tip.nameKey)}
          className="nectar-mentor-img"
          style={{ width: 88, height: 88, objectFit: 'contain', flexShrink: 0 }}
        />
        <div className="nectar-mentor-text">
          <span className="nectar-mentor-name">{t(tip.nameKey)}</span>
          <p className="nectar-mentor-msg">{t(tip.tipKey)}</p>
        </div>
      </div>
      <span className="nectar-mentor-dismiss">{t('nectar.mentor.tapToDismiss')}</span>
    </div>
  );
}
