import type { ReactNode } from 'react';
import { StandaloneHeader } from '@/rebuild/design/StandaloneHeader';
import { ButtonGroup, ButtonLink, LoadingState, SingleStateScreen } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { follow, siteCopy, StartButton, type Navigate, type StartAction } from './blocks';

/*
 * M7, the public badge-link page, rebuilt (S10L.3). It replaced the last
 * legacy body a product route rendered (legacy Button, Card, LoadingOverlay
 * and i18next copy). The route bridge (routes/marketing/BadgeLandingPage.tsx)
 * owns the fetch, the OD-20 retirement date and the session-aware call to
 * action; this surface reads no session, router or analytics.
 *
 * OD-20: new shares are images a parent sends, so no new link is issued. A
 * link issued before the cutover renders here until it expires; Core refuses
 * a revoked, expired or post-cutover link and the page says the link expired.
 * Nothing here tracks the viewer (Appendix L counts shares, never reach), and
 * the page shows the badge image with no celebration: it is a stranger's view
 * of another family's milestone, not the learner's own moment (OD-7).
 */
export interface BadgePayload {
  firstName: string;
  achievementKind: 'course_badge' | 'streak' | 'goal_reached';
  achievementLabel: string;
  imageUrl: string;
}

export type BadgeLandingState = { status: 'loading' } | { status: 'expired' } | { status: 'ready'; payload: BadgePayload };

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function BadgeLanding({ locale, state, start, onNavigate, header }: {
  locale: Locale; state: BadgeLandingState; start: StartAction; onNavigate?: Navigate; header?: ReactNode;
}) {
  const site = siteCopy(locale);
  const copy = site.badgeLanding;
  const skip = rebuildNamespaceCopy[locale].core.appShell.skip;
  const actions = <ButtonGroup>
    <StartButton action={start} copy={site.site} onNavigate={onNavigate} origin="badge-landing" />
    <ButtonLink href="/how-it-works" onClick={follow('/how-it-works', onNavigate)}>{copy.howItWorks}</ButtonLink>
  </ButtonGroup>;

  if (state.status === 'loading') {
    return <SingleStateScreen appName="LittleFounders" pageTitle={copy.loading} routeKey="badge-landing" locale={locale} hue="primary" labels={{ skip }} bar={header ?? <StandaloneHeader marketing locale={locale} theme="light" />}>
      <div className="lf-badge-landing" data-screen="badge-landing" data-state="loading">
        <LoadingState label={copy.loading} lines={2} />
      </div>
    </SingleStateScreen>;
  }

  if (state.status === 'expired') {
    return <SingleStateScreen appName="LittleFounders" pageTitle={copy.expiredTitle} routeKey="badge-landing" locale={locale} hue="primary"
      labels={{ skip }} bar={header ?? <StandaloneHeader marketing locale={locale} theme="light" />} actions={actions}>
      <div className="lf-badge-landing" data-screen="badge-landing" data-state="expired">
        <h1 data-copy-role="heading">{copy.expiredTitle}</h1>
        <p data-copy-role="body">{copy.expiredBody}</p>
      </div>
    </SingleStateScreen>;
  }

  const values = { name: state.payload.firstName, achievement: state.payload.achievementLabel };
  const title = fill(copy.title, values);
  return <SingleStateScreen appName="LittleFounders" pageTitle={title} routeKey="badge-landing" locale={locale} hue="primary"
    labels={{ skip }} bar={header ?? <StandaloneHeader marketing locale={locale} theme="light" />} actions={actions}>
    <div className="lf-badge-landing" data-screen="badge-landing" data-state="ready" data-kind={state.payload.achievementKind}>
      {/* The share image Depot rendered for this badge (a server render of our own art, not a manifest slot). */}
      <img className="lf-badge-landing-image" src={state.payload.imageUrl} alt={fill(copy.imageAlt, values)} width={1080} height={1920} />
      {/* A first name and a course label are user and catalogue text: they wrap anywhere (02 §7 rule 8). */}
      <h1 className="lf-badge-landing-title" data-copy-role="heading">{title}</h1>
      <p data-copy-role="body">{copy.body}</p>
    </div>
  </SingleStateScreen>;
}
