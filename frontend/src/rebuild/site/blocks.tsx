import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { Art, Button, ButtonLink, InlineNotice, MENTOR_CHARACTERS, MENTOR_NAMES, MentorAvatar, RadioGroup, useRebuildEnvironment } from '../design/controls';
import { findMentorAvatar } from '../design/assets';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import './site.css';

/*
 * The public site's building blocks (M1–M4, W2 Lane 1), composed from the
 * shared controls only (02 rule 23). A page is a neutral page with coloured
 * bands (02 §4.5: many independent pieces of content), laid out by the `app`
 * container width (02 §7 rule 9): the hero splits 7:5 from 840 px (03 §3.3),
 * the art moves above the copy below 400 px, and section paddings vary
 * (tight / default / loose / band) so no three sections share one rhythm.
 *
 * Nothing here reads the session, the router or analytics: the route bridges
 * in `routes/marketing/` pass the session-aware call to action and a
 * navigation callback, so every surface stays inside the rebuilt boundary.
 */

/** The shared call-to-action strings (the `site` group of the namespace). */
export type SiteCopy = (typeof rebuildNamespaceCopy)['en-US']['site']['site'];

/** The public site's own strings in a locale. */
export function siteCopy(locale: Locale) {
  return rebuildNamespaceCopy[locale].site;
}

/** Client-side navigation for a link; a modified click keeps the browser's own behaviour. */
export type Navigate = (href: string) => void;

export function follow(href: string, onNavigate?: Navigate, after?: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    after?.();
    if (!onNavigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
}

/**
 * The page's main call to action (02 §9.5: accent, the one "press me" hue).
 * A visitor starts a guest session, no sign-up (the SPEC's "Start free" entry,
 * M1); anyone already signed in continues where they left off. The bridge
 * decides which, from the session; the label never promises more than that.
 */
export type StartAction =
  /** `pending` and `failed` name the button (its `origin`) that started the guest session, so only it reacts. */
  | { kind: 'guest'; pending: string | null; failed: string | null; onStart: (origin: string) => void }
  | { kind: 'continue'; href: string; onFollow?: () => void };

export function StartButton({ action, copy, onNavigate, origin, size = 'lg', breathing = false }: {
  action: StartAction; copy: SiteCopy; onNavigate?: Navigate; origin: string; size?: 'md' | 'lg'; breathing?: boolean;
}) {
  if (action.kind === 'continue') {
    return <ButtonLink variant="accent" size={size} href={action.href} data-cta="continue"
      onClick={follow(action.href, onNavigate, action.onFollow)}>{copy.continue}</ButtonLink>;
  }
  return <>
    <Button variant="accent" size={size} breathing={breathing} data-cta="start-free" data-origin={origin}
      pending={action.pending === origin} pendingLabel={copy.starting} disabled={action.pending !== null && action.pending !== origin}
      onClick={() => action.onStart(origin)}>{copy.startFree}</Button>
    {/* A failed guest start must say so, beside the button that was pressed: a silent failure looks like a dead button (M1). */}
    {action.failed === origin ? <InlineNotice tone="error" live>{copy.startError}</InlineNotice> : null}
  </>;
}

/**
 * The Tutor call to action on the family pages. A visitor is offered the brand
 * line (OD-6: "Become your child's Tutor"); a verified parent goes to the
 * family; anyone else signed in goes back into the app, where the navigation
 * offers verification to an adult who is not yet a Tutor (never to a child or
 * a teen: minor safeguards follow age, OD-3).
 */
export type TutorAction = { kind: 'visitor'; onFollow?: () => void } | { kind: 'parent' } | { kind: 'member'; href: string };

export function TutorButton({ action, copy, onNavigate }: { action: TutorAction; copy: SiteCopy; onNavigate?: Navigate }) {
  if (action.kind === 'parent') return <ButtonLink variant="accent" size="lg" href="/family" onClick={follow('/family', onNavigate)}>{copy.openFamily}</ButtonLink>;
  if (action.kind === 'member') return <ButtonLink variant="accent" size="lg" href={action.href} onClick={follow(action.href, onNavigate)}>{copy.openApp}</ButtonLink>;
  // The approved brand line is `brand` copy (06 §3.3), so it is a link styled as the accent button, not a budgeted action.
  return <a className="lf-button lf-button--accent lf-button--lg lf-button-link" href="/signup?intent=tutor" data-copy-role="brand"
    data-cta="become-tutor" onClick={follow('/signup?intent=tutor', onNavigate, action.onFollow)}>{copy.becomeTutor}</a>;
}

export type SectionTone = 'loose' | 'default' | 'tight' | 'band' | 'soft';

/** One section of a public page. `band` is the full-colour block every page carries once (03 §3.3). */
export function SiteSection({ tone = 'default', heading, headingId, children, split, className }: {
  tone?: SectionTone; heading?: ReactNode; headingId?: string; children: ReactNode; split?: 'start' | 'end'; className?: string;
}) {
  const generated = useId();
  const id = headingId ?? generated;
  return <section className={`lf-site-section lf-site-section--${tone}${split ? ` lf-site-section--split lf-site-section--split-${split}` : ''}${className ? ` ${className}` : ''}`}
    data-section aria-labelledby={heading ? id : undefined}>
    {heading ? <h2 id={id} data-copy-role="heading">{heading}</h2> : null}
    {children}
  </section>;
}

/**
 * The hero: copy and art, 7:5 from an 840 px container (never 1:1, 03 §3.3);
 * the art first below 400 px (02 §7 rule 9). Art is an illustration only (the
 * real-model Mentor renders); an interactive demo belongs in its own section,
 * never above the page's heading on a phone. Without art the hero is one column.
 */
export function SiteHero({ children, art }: { children: ReactNode; art?: ReactNode }) {
  if (!art) return <section className="lf-site-hero lf-site-hero--solo" data-section><div className="lf-site-hero-copy">{children}</div></section>;
  return <section className="lf-site-hero" data-layout="hero" data-section>
    <div className="lf-site-hero-copy">{children}</div>
    <div className="lf-site-hero-art">{art}</div>
  </section>;
}

/**
 * The four Mentor characters, each a render of its real 3D model (02 rule 21,
 * 07 §4), named by `MENTOR_NAMES` so the name can never disagree with the
 * picture. A genuinely uniform collection, marked as one (03 §3.3).
 */
export function MentorCast({ label, size = 'lg' }: { label: string; size?: 'md' | 'lg' }) {
  const { theme } = useRebuildEnvironment();
  return <ul className="lf-site-cast" data-uniform="collection" aria-label={label}>
    {MENTOR_CHARACTERS.map((character) => {
      const render = findMentorAvatar(character, theme);
      return <li key={character} className="lf-site-cast-member">
        {render ? <MentorAvatar renderId={render} label={null} size={size} /> : null}
        <span data-copy-role="data">{MENTOR_NAMES[character]}</span>
      </li>;
    })}
  </ul>;
}

/**
 * A decision with consequences, not a quiz (M2, M3): no option is right or
 * wrong, picking another swaps the consequence in place, and the consequence
 * is announced politely without moving focus. It uses the shared "choose one"
 * control (02 §9.5), so the demo is the product's own control.
 */
export function DecisionDemo<T extends string>({ name, question, options, prompt, art }: {
  name: string; question: string; prompt: string;
  options: readonly { value: T; label: string; consequence: string }[];
  /** A manifest asset per option (the pocket icons), drawn beside the consequence. */
  art?: Partial<Record<T, string>>;
}) {
  const [picked, setPicked] = useState<T | null>(null);
  const chosen = options.find((option) => option.value === picked) ?? null;
  const asset = chosen && art ? art[chosen.value] : undefined;
  return <div className="lf-site-decision" data-decision={name}>
    <RadioGroup legend={question} name={name} value={picked} onValueChange={setPicked}
      options={options.map(({ value, label }) => ({ value, label }))} />
    <div className="lf-site-consequence" data-picked={picked ?? undefined}>
      {asset ? <Art assetId={asset} /> : null}
      <p role="status" aria-live="polite" data-copy-role="body">{chosen ? chosen.consequence : prompt}</p>
    </div>
  </div>;
}

/** Numbered steps as a staircase on wide containers (03 §3.3), one reading column below. */
export function SiteSteps({ label, steps }: { label: string; steps: readonly { title: string; body: string }[] }) {
  return <ol className="lf-site-steps" aria-label={label}>
    {steps.map((step, index) => <li key={step.title} className="lf-site-step">
      <span className="lf-site-step-number" data-copy-role="data" aria-hidden="true">{index + 1}</span>
      <h3 data-copy-role="heading">{step.title}</h3>
      <p data-copy-role="body">{step.body}</p>
    </li>)}
  </ol>;
}

/** A link that reads as a secondary button (a place, not an action). */
export function SiteLink({ href, children, onNavigate, variant = 'secondary', size = 'sm', onFollow, ...data }: {
  href: string; children: ReactNode; onNavigate?: Navigate; variant?: 'secondary' | 'inverse' | 'brand'; size?: 'sm' | 'md';
  onFollow?: () => void;
} & { [attribute: `data-${string}`]: string | undefined }) {
  const internal = href.startsWith('/');
  return <ButtonLink {...data} variant={variant} size={size} href={href} onClick={internal ? follow(href, onNavigate, onFollow) : onFollow}>{children}</ButtonLink>;
}
