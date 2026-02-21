/* ──────────────────────────────────────────────────────────────
   Pause Overlay – Néctar de las Sombras
   ────────────────────────────────────────────────────────────── */

import { useTranslation } from 'react-i18next';

interface Props {
  soundOn: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onToggleSound: () => void;
}

export function PauseOverlay({ soundOn, onResume, onRestart, onQuit, onToggleSound }: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="nectar-pause-overlay">
      <div className="nectar-pause-card">
        <h2 className="nectar-pause-title">{t('nectar.pause.title')}</h2>

        <div className="nectar-pause-buttons">
          <button className="nectar-btn nectar-btn-primary" onClick={onResume}>
            {t('nectar.pause.resume')}
          </button>
          <button className="nectar-btn nectar-btn-secondary" onClick={onRestart}>
            {t('nectar.pause.restart')}
          </button>
          <button className="nectar-btn nectar-btn-ghost" onClick={onToggleSound}>
            {soundOn ? t('nectar.pause.soundOn') : t('nectar.pause.soundOff')}
          </button>
          <button className="nectar-btn nectar-btn-ghost" onClick={onQuit}>
            {t('nectar.pause.quit')}
          </button>
        </div>
      </div>
    </div>
  );
}
