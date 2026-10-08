import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRebuildEnvironment } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { siteCopy } from '../blocks';
import { TabletClip } from '../value/TabletVideo';
import '../value/value.css';
import './boards.css';

/*
 * Landing section 4 (owner brief, 2026-10-06): the Pizarrón, three tabs, each one the real Mentor screen with its board open
 * (the Diorama, the Mentor beside it and the same board the lesson uses), recorded by scripts/render-site-tablet-video.mjs
 * with a cursor using it. No drawn diagram: the board is the app's own. The still paints at once and stays for reduced motion
 * or less data; only the open tab's clip plays. Tabs follow the WAI tabs pattern (arrow keys move, Home and End jump).
 */
const BASE = '/rebuild/landing/tablet';
const KINDS = ['scale', 'partition', 'receipt'] as const;

export function BoardsSection({ locale }: { locale: Locale }) {
  const l = siteCopy(locale).landingV2;
  const { theme } = useRebuildEnvironment();
  const id = useId();
  const [open, setOpen] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const last = l.boardsTabs.length - 1;
    const next = event.key === 'ArrowRight' ? (index + 1) % (last + 1) : event.key === 'ArrowLeft' ? (index + last) % (last + 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    setOpen(next);
    tabs.current[next]?.focus();
  };
  return <section className="lf-boards" data-section data-layout="boards" aria-labelledby={`${id}-title`}>
    <header className="lf-boards-head">
      <h2 id={`${id}-title`} data-copy-role="heading">{l.boardsTitle}</h2>
      <p data-copy-role="body">{l.boardsLead}</p>
    </header>
    <div className="lf-boards-tabs" role="tablist" aria-labelledby={`${id}-title`}>
      {l.boardsTabs.map((tab, index) => <button key={tab.label} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${index}`}
        aria-selected={open === index} aria-controls={`${id}-panel`} tabIndex={open === index ? 0 : -1} onClick={() => setOpen(index)} onKeyDown={(event) => move(event, index)}>
        <span data-copy-role="action">{tab.label}</span>
      </button>)}
    </div>
    <div className="lf-boards-device" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${open}`}>
      <div className="lf-value-tablet">
        <div className="lf-value-screen">
          {l.boardsTabs.map((tab, index) => <img key={tab.label} src={`${BASE}/tablet-board-${KINDS[index]}-${locale}-${theme}.webp`} alt={tab.alt} width={1280} height={960}
            loading="lazy" decoding="async" data-active={open === index} aria-hidden={open === index ? undefined : true} />)}
          {l.boardsTabs.map((tab, index) => <TabletClip key={tab.label} view={`board-${KINDS[index]}`} locale={locale} theme={theme} active={open === index} />)}
        </div>
      </div>
    </div>
    <p className="lf-boards-bridge" data-copy-role="body">{l.boardsBridge}</p>
  </section>;
}
