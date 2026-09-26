import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Button, ButtonLink, Chip, InlineNotice, Sheet } from '../design/controls';
import { useLayerHost } from '../design/layers';
import type { Locale } from '../design/copyBudget';
import { follow, siteCopy, type Navigate } from './blocks';
import '../design/tokens.css';
import '../design/system.css';

/*
 * M8, the cookie choice, rebuilt (W2 Lane 1). Privacy-preserving by default:
 * nothing optional runs until the visitor accepts, rejecting is as easy and as
 * prominent as accepting (two equal buttons, neither pre-selected), and a
 * choice can be changed at any time from the site footer's "Cookie
 * preferences" (and from the Privacy Notice).
 *
 * It is the public visitor's choice only. A child's behavioural data is
 * governed by the verified guardian's consent and a teen's by their own
 * analytics choice (rebuild/privacy); this banner is never shown to a signed-in
 * account (the bridge decides that, as the legacy banner did).
 *
 * What it controls is what the product actually does (lib/visitor): one
 * decision covers both optional kinds (where a visit came from, and visit
 * measurement), so the preferences say so instead of drawing two switches
 * that could not be set apart. Separate choices per kind are an owner
 * question recorded in the lane record.
 *
 * The banner is a non-modal region docked at the bottom above the page's own
 * docked bar (02 §9.8 layer order), in its own body-level host that carries
 * the site's mode and language; it never takes focus from the page. The
 * preferences are a modal sheet (focus trap, Escape, focus returns).
 */

export type CookieChoice = 'granted' | 'denied' | 'unset';

export function CookieConsent({ locale, bannerVisible, choice, preferencesOpen, onOpenPreferences, onClosePreferences, onDecide, onNavigate }: {
  locale: Locale;
  /** The banner: a visitor who has not chosen yet, on a public page. */
  bannerVisible: boolean;
  choice: CookieChoice;
  preferencesOpen: boolean;
  onOpenPreferences: () => void;
  onClosePreferences: () => void;
  onDecide: (granted: boolean) => void;
  onNavigate?: Navigate;
}) {
  const copy = siteCopy(locale).cookies;
  const host = useLayerHost(bannerVisible && !preferencesOpen, { layer: 'nav' });
  const headingId = useId();
  const decisions = <>
    <Button data-consent="reject" onClick={() => onDecide(false)}>{copy.reject}</Button>
    <Button data-consent="accept" onClick={() => onDecide(true)}>{copy.accept}</Button>
  </>;
  const current = choice === 'granted' ? copy.currentGranted : choice === 'denied' ? copy.currentDenied : copy.currentUnset;
  return <>
    {host && bannerVisible && !preferencesOpen ? createPortal(<section className="lf-consent" aria-labelledby={headingId} data-surface="site" data-consent-banner data-dock>
      <div className="lf-consent-inner">
        <div className="lf-consent-text">
          <h2 id={headingId} data-copy-role="heading">{copy.title}</h2>
          <p data-copy-role="body">{copy.body}</p>
        </div>
        <div className="lf-consent-actions">
          {decisions}
          <Button size="sm" data-consent="preferences" aria-haspopup="dialog" onClick={onOpenPreferences}>{copy.preferences}</Button>
        </div>
      </div>
    </section>, host) : null}

    <Sheet open={preferencesOpen} onClose={onClosePreferences} heading={copy.sheetTitle} closeLabel={copy.close}
      footer={<div className="lf-consent-actions">{decisions}</div>}>
      <div className="lf-consent-sheet" data-surface="site" data-consent-preferences>
        <p data-copy-role="body">{copy.sheetIntro}</p>
        <InlineNotice tone="info">{current}</InlineNotice>
        <ul className="lf-consent-kinds">
          <li className="lf-consent-kind">
            <h3 data-copy-role="heading">{copy.necessaryTitle}</h3>
            <Chip tone="success" glyph="check">{copy.alwaysOn}</Chip>
            <p data-copy-role="body">{copy.necessaryBody}</p>
          </li>
          <li className="lf-consent-kind">
            <h3 data-copy-role="heading">{copy.attributionTitle}</h3>
            <Chip tone="primary" glyph="info">{copy.optional}</Chip>
            <p data-copy-role="body">{copy.attributionBody}</p>
          </li>
          <li className="lf-consent-kind">
            <h3 data-copy-role="heading">{copy.measurementTitle}</h3>
            <Chip tone="primary" glyph="info">{copy.optional}</Chip>
            <p data-copy-role="body">{copy.measurementBody}</p>
          </li>
        </ul>
        <p data-copy-role="body">{copy.together}</p>
        <ButtonLink size="sm" href="/legal/privacy" onClick={follow('/legal/privacy', onNavigate, onClosePreferences)}>{copy.privacyLink}</ButtonLink>
      </div>
    </Sheet>
  </>;
}
