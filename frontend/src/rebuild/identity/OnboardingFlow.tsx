import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button, IconButton, InlineNotice, ProgressBar, RadioGroup, SingleStateScreen, TextField, type MentorCharacter,
} from '../design/controls';
import { MentorChooser } from '../mentor/MentorChooser';
import type { Locale } from '../design/copyBudget';
import { identityCopy } from './authBlocks';

/*
 * O1 Onboarding, rebuilt (W2S.2). A guest's one-time first run: welcome, name
 * (required), the Mentor (optional), how they found us (optional) and the offer
 * to save their progress now or later. Each step is one state, so each is a
 * full-bleed single-state screen (02 §4.5, rule 15): one hue, the step's
 * content on a tint of it, the actions docked in the thumb zone, the progress
 * and the way back in the bar.
 *
 * What changed from the legacy flow (OD-15, 02 rules 22–23): no legacy
 * component, no narration by the four characters in turn and no speech
 * bubbles. The Mentor is the learner's own choice (OD-6, 08 §8): the four real
 * characters as renders of the real models (07 §4), each with its name and one
 * short line, saved to the same preference the Mentor screen reads. The step
 * is the shared MentorChooser (08 §8: the characters standing on their
 * Diorama, `mentor.chooserStill`), not bust avatars in a list. The
 * mandatory age question is not here: the route guard asks it before this
 * screen mounts (A.3, A.4), and this flow never asks for a date again.
 *
 * A guest can be a child who was refused at sign-up (A.2), so every string is
 * budgeted for the youngest band (06 §3.1: 25 words on the first view).
 *
 * That same guest is why the discovery step is conditional (A.2, Appendix M
 * 1.1: no analytics event for a flagged session without an equivalent consent
 * mechanism). Core stores the answer only for an account signup attribution
 * would admit and tells the flow through /auth/me; otherwise the step is not
 * shown and the progress reads "n of 4".
 */

export const DISCOVERY_CHANNELS = ['friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other'] as const;
export type DiscoveryChannel = (typeof DISCOVERY_CHANNELS)[number];
export const ONBOARDING_STEPS = ['welcome', 'name', 'mentor', 'discovery', 'account'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
/**
 * A.2, Appendix M 1.1: the "how did you hear about us" step is asked only when Core would keep the answer
 * (never a guest from the age-refusal path, a kid, or a teen who has not opted in). Without it the flow is 4 steps.
 */
export const onboardingSteps = (askDiscovery: boolean): readonly OnboardingStep[] =>
  askDiscovery ? ONBOARDING_STEPS : ONBOARDING_STEPS.filter((step) => step !== 'discovery');
export type AccountChoice = 'created_now' | 'later';

export interface MentorChoiceState {
  /** The saved choice (null: none yet). */
  chosen: MentorCharacter | null;
  /** The character whose save is in flight. */
  saving: MentorCharacter | null;
  failed: boolean;
  onChoose: (character: MentorCharacter) => void;
}

export interface OnboardingValues { displayName: string; discoveryChannel: DiscoveryChannel | null; choice: AccountChoice }

export function OnboardingFlow({ locale, skipLabel, mentor, askDiscovery, completing, failed, onComplete, initialStep = 'welcome', initialName = '' }: {
  locale: Locale; skipLabel: string; mentor: MentorChoiceState;
  /** Core's /auth/me `discoverySurvey`: show the optional discovery step (A.2). */
  askDiscovery: boolean;
  /** The account choice whose completion request is in flight. */
  completing: AccountChoice | null; failed: boolean;
  onComplete: (values: OnboardingValues) => void;
  /** Preview and test entry points. */
  initialStep?: OnboardingStep; initialName?: string;
}) {
  const copy = identityCopy(locale).onboardingFlow;
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [name, setName] = useState(initialName);
  const [channel, setChannel] = useState<DiscoveryChannel | null>(null);
  const steps = onboardingSteps(askDiscovery);
  const index = Math.max(0, steps.indexOf(step));
  const afterMentor: OnboardingStep = askDiscovery ? 'discovery' : 'account';
  const trimmed = name.trim();

  // A new step replaces the last in place: focus moves to its heading, and the page starts at the top (02 rule 13).
  const heading = useRef<HTMLHeadingElement>(null);
  const settled = useRef(step);
  useEffect(() => {
    if (settled.current === step) return;
    settled.current = step;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const go = (next: OnboardingStep) => setStep(next);
  const busy = completing !== null;
  const progress = copy.progress.replace('{current}', String(index + 1)).replace('{total}', String(steps.length));

  const bar = <div className="lf-onboarding-bar">
    {index > 0 ? <IconButton glyph="back" label={copy.back} variant="inverse" disabled={busy} onClick={() => go(steps[index - 1]!)} data-onboarding="back" /> : null}
    <div className="lf-onboarding-progress">
      <p data-copy-role="body">{progress}</p>
      <ProgressBar label={progress} labelHidden value={index + 1} max={steps.length} valueText={progress} tone="mint" />
    </div>
  </div>;

  let content: ReactNode;
  let actions: ReactNode;
  switch (step) {
    case 'welcome':
      content = <>
        <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{copy.welcomeTitle}</h1>
        <p data-copy-role="body">{copy.welcomeBody}</p>
      </>;
      actions = <Button variant="accent" size="lg" onClick={() => go('name')} data-onboarding="start">{copy.start}</Button>;
      break;
    case 'name':
      content = <form id="onboarding-name-form" className="lf-onboarding-form" noValidate onSubmit={(event) => { event.preventDefault(); if (trimmed) go('mentor'); }}>
        <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{copy.nameTitle}</h1>
        <TextField label={copy.nameLabel} value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" maxLength={80} required />
      </form>;
      actions = <Button type="submit" form="onboarding-name-form" variant="accent" size="lg" disabled={!trimmed} data-onboarding="continue">{copy.continue}</Button>;
      break;
    case 'mentor':
      content = <>
        <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{copy.mentorTitle}</h1>
        {/* 08 §8: the four real characters on their Diorama, the same chooser the Mentor screen uses. */}
        <MentorChooser label={copy.mentorTitle} lines={copy.lines} chosen={mentor.chosen} saving={mentor.saving}
          chosenLabel={copy.chosen} savingLabel={copy.saving} chosenTone="success" onChoose={mentor.onChoose} />
        {mentor.failed ? <InlineNotice tone="error" live>{copy.mentorFailed}</InlineNotice> : null}
      </>;
      actions = <>
        <Button variant="accent" size="lg" disabled={!mentor.chosen || mentor.saving !== null} onClick={() => go(afterMentor)} data-onboarding="continue">{copy.continue}</Button>
        <Button size="lg" disabled={mentor.saving !== null} onClick={() => go(afterMentor)} data-onboarding="skip">{copy.skip}</Button>
      </>;
      break;
    case 'discovery':
      content = <>
        <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{copy.discoveryTitle}</h1>
        <RadioGroup legend={copy.discoveryLegend} name="onboarding-discovery" value={channel} onValueChange={setChannel}
          options={DISCOVERY_CHANNELS.map((value) => ({ value, label: copy.channels[value] }))} />
      </>;
      actions = <>
        <Button variant="accent" size="lg" disabled={!channel} onClick={() => go('account')} data-onboarding="continue">{copy.continue}</Button>
        <Button size="lg" onClick={() => { setChannel(null); go('account'); }} data-onboarding="skip">{copy.skip}</Button>
      </>;
      break;
    case 'account':
      content = <>
        <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{copy.accountTitle}</h1>
        <p data-copy-role="body">{copy.accountBody}</p>
        {failed ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
      </>;
      actions = <>
        <Button variant="accent" size="lg" disabled={busy && completing !== 'created_now'} pending={completing === 'created_now'} pendingLabel={copy.saving}
          onClick={() => onComplete({ displayName: trimmed, discoveryChannel: askDiscovery ? channel : null, choice: 'created_now' })} data-onboarding="create">{copy.create}</Button>
        <Button size="lg" disabled={busy && completing !== 'later'} pending={completing === 'later'} pendingLabel={copy.saving}
          onClick={() => onComplete({ displayName: trimmed, discoveryChannel: askDiscovery ? channel : null, choice: 'later' })} data-onboarding="later">{copy.later}</Button>
      </>;
      break;
  }

  return <div data-age-band="6-9" data-screen="onboarding" data-step={step} data-surface="app">
    <SingleStateScreen appName="LittleFounders" pageTitle={copy.title} routeKey="onboarding" locale={locale} hue="primary"
      labels={{ skip: skipLabel }} bar={bar} actions={actions}>
      <div className="lf-onboarding-panel">{content}</div>
    </SingleStateScreen>
  </div>;
}
