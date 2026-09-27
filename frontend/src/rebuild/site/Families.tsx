import { useState } from 'react';
import { Button, Card, InlineNotice, MentorAvatar, Pill, useRebuildEnvironment } from '../design/controls';
import { findMentorAvatar, MENTOR_NAMES } from '../design/assets';
import type { Locale } from '../design/copyBudget';
import { DecisionDemo, SiteHero, SiteLink, SiteSection, SiteSteps, TutorButton, siteCopy, type Navigate, type TutorAction } from './blocks';

/*
 * M3, For families, rebuilt on the public-site shell (W2 Lane 1).
 *
 * The page speaks to the parent's authority (brand Law 1, Law 5): the Tutor
 * reads every Mentor conversation, approves what the Mentor may remember,
 * sets chores and approves them (or lets small ones through at the level
 * they choose, D.17), and sees their child's map. Each claim is one the FAQ
 * states and a gate or the code backs (A.1); the chore wording follows the
 * Block D controls registry (approval or the granted level; share coins go to
 * a place the Tutor chose, D.14). "Tutor" is only the verified parent; the AI
 * is "the Mentor" (OD-6).
 *
 * The example exchange is illustrative and labelled "Example": pressing
 * Approve there changes nothing anywhere. Legacy pieces not carried over: the
 * illustrative family panel with invented children and balances (it read as
 * real data), the raster mentor busts (look-alikes, 07 §4), and a claim about
 * exactly what reaches the AI model that this page cannot keep true.
 */

function ExampleExchange({ locale }: { locale: Locale }) {
  const f = siteCopy(locale).families;
  const { theme } = useRebuildEnvironment();
  const [memory, setMemory] = useState<'pending' | 'approved' | 'declined'>('pending');
  const avatar = findMentorAvatar('dina', theme);
  return <Card as="div">
    <Pill tone="sky">{f.exampleLabel}</Pill>
    <div className="lf-site-exchange">
      <p className="lf-site-exchange-label" data-copy-role="body">{f.childLabel}</p>
      <p data-copy-role="body">{f.childLine}</p>
    </div>
    <div className="lf-site-exchange lf-site-exchange--mentor">
      {avatar ? <MentorAvatar renderId={avatar} label={null} size="md" /> : null}
      <div className="lf-site-exchange-text">
        <p className="lf-site-exchange-label" data-copy-role="data">{MENTOR_NAMES.dina}</p>
        <p data-copy-role="body">{f.mentorLine}</p>
      </div>
    </div>
    <div className="lf-site-memory">
      <p className="lf-site-exchange-label" data-copy-role="body">{f.memoryPrompt}</p>
      <p data-copy-role="body">{f.memoryNote}</p>
      {memory === 'pending'
        ? <div className="lf-site-cta-row">
          <Button variant="success" size="sm" data-example="approve" onClick={() => setMemory('approved')}>{f.approve}</Button>
          <Button size="sm" data-example="decline" onClick={() => setMemory('declined')}>{f.notNow}</Button>
        </div>
        : <p role="status" data-copy-role="body">{memory === 'approved' ? f.approved : f.declined}</p>}
    </div>
  </Card>;
}

export function Families({ locale, tutor, onNavigate }: { locale: Locale; tutor: TutorAction; onNavigate?: Navigate }) {
  const copy = siteCopy(locale);
  const f = copy.families;
  return <div className="lf-site-page" data-screen="families">
    <SiteHero>
      <h1 data-copy-role="heading">{f.title}</h1>
      <p className="lf-site-lead" data-copy-role="body">{f.lead}</p>
      <div className="lf-site-cta-row">
        <TutorButton action={tutor} copy={copy.site} onNavigate={onNavigate} />
        {tutor.kind === 'visitor' ? <SiteLink href="/login" size="md" onNavigate={onNavigate}>{copy.site.login}</SiteLink> : null}
      </div>
    </SiteHero>

    <SiteSection tone="loose" heading={f.visibilityTitle} split="start">
      <div className="lf-site-split-copy">
        <p data-copy-role="body">{f.visibilityBody}</p>
        <InlineNotice tone="info">{f.micNote}</InlineNotice>
      </div>
      <ExampleExchange locale={locale} />
    </SiteSection>

    <SiteSection tone="default" heading={f.choresTitle} split="end">
      <div className="lf-site-split-copy"><p data-copy-role="body">{f.choresBody}</p></div>
      <DecisionDemo name="families-chore" question={f.choresQuestion} prompt={copy.site.pickOne}
        art={{ save: 'pocket.save.icon', spend: 'pocket.spend.icon', share: 'pocket.share.icon' }}
        options={[
          { value: 'save', label: f.save, consequence: f.consequenceSave },
          { value: 'spend', label: f.spend, consequence: f.consequenceSpend },
          { value: 'share', label: f.share, consequence: f.consequenceShare },
        ]} />
    </SiteSection>

    <SiteSection tone="band" heading={f.bankingTitle}>
      <Pill tone="inverse">{f.simulation}</Pill>
      <p data-copy-role="body">{f.bankingBody}</p>
    </SiteSection>

    <SiteSection tone="tight" className="lf-site-pair">
      <Card heading={f.mapTitle}><p data-copy-role="body">{f.mapBody}</p></Card>
      <Card heading={f.privacyTitle}><p data-copy-role="body">{f.privacyBody}</p></Card>
    </SiteSection>

    <SiteSection tone="soft" heading={f.stepsTitle}>
      <SiteSteps label={f.stepsTitle} steps={[
        { title: f.step1Title, body: f.step1Body },
        { title: f.step2Title, body: f.step2Body },
        { title: f.step3Title, body: f.step3Body },
        { title: f.step4Title, body: f.step4Body },
      ]} />
    </SiteSection>

    <SiteSection tone="default" heading={f.closingTitle} className="lf-site-closing">
      <p data-copy-role="body">{f.closingBody}</p>
      <div className="lf-site-cta-row"><TutorButton action={tutor} copy={copy.site} onNavigate={onNavigate} /></div>
    </SiteSection>
  </div>;
}

