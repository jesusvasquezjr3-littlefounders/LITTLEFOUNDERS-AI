import { useId, useState } from 'react';
import { TileButton, useRebuildEnvironment } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { siteCopy } from '../blocks';
import { ActorClip } from '../ActorClip';
import { TabletClip } from './TabletVideo';
import './value.css';

/*
 * Landing section 2, "the value of money" (owner brief, 2026-10-06): an
 * accordion on one side, and on the other a tablet showing the app's own screen
 * for the open card, with Zara leaning in over its edge. The screens are real
 * (the app's components with fixture data, rendered by
 * scripts/render-site-tablet.mjs), one image per card, locale and colour mode,
 * so the section costs the page about 30 KB per screen and no script of its own
 * beyond the accordion. Over the open card's still plays its clip: someone using that
 * screen with a cursor (`TabletVideo.tsx`, scripts/render-site-tablet-video.mjs).
 */
// Card order in the copy: goals (Wallet), decisions (the story bringing an earlier choice back), a safe experience (end of a lesson).
const VIEW_OF_CARD = ['wallet', 'recall', 'result'] as const;
const BASE = '/rebuild/landing/tablet';

export function ValueSection({ locale }: { locale: Locale }) {
  const l = siteCopy(locale).landingV2;
  const { theme } = useRebuildEnvironment();
  const id = useId();
  const [open, setOpen] = useState(0);
  return <section className="lf-value" data-section data-layout="value" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="lf-value-title" data-copy-role="heading">{l.valueTitle}</h2>
    <div className="lf-value-cards">
      {l.valueCards.map((card, index) => {
        const active = open === index;
        return <div key={card.title} className="lf-value-card" data-active={active}>
          <h3 data-copy-role="heading">
            <TileButton id={`${id}-tab-${index}`} aria-expanded={active} aria-controls={`${id}-panel-${index}`} onClick={() => setOpen(index)}>
              <span className="lf-value-number" aria-hidden="true">{index + 1}</span><span>{card.title}</span>
            </TileButton>
          </h3>
          <div id={`${id}-panel-${index}`} role="region" aria-labelledby={`${id}-tab-${index}`} hidden={!active}>
            <p data-copy-role="body">{card.body}</p>
          </div>
        </div>;
      })}
    </div>
    <div className="lf-value-device">
      <ActorClip name="peek-zara" className="lf-value-peek" />
      <div className="lf-value-tablet">
        <div className="lf-value-screen">
          {l.valueCards.map((card, index) => <img key={card.title} src={`${BASE}/tablet-${VIEW_OF_CARD[index]}-${locale}-${theme}.webp`} alt={card.alt} width={1280} height={960}
            loading={index === 0 ? 'eager' : 'lazy'} decoding="async" data-active={open === index} aria-hidden={open === index ? undefined : true}
            data-asset-id={`site.landing.tablet.${VIEW_OF_CARD[index]}.${locale}.${theme}`} />)}
          {l.valueCards.map((card, index) => <TabletClip key={card.title} view={VIEW_OF_CARD[index]!} locale={locale} theme={theme} active={open === index} />)}
        </div>
      </div>
    </div>
  </section>;
}
