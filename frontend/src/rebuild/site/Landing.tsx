import { MarketingArt } from './MarketingArt';
import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { StartButton, siteCopy, type Navigate, type StartAction, type TutorAction } from './blocks';
import { Hero } from './hero/Hero';
import { BoardsSection } from './boards/BoardsSection';
import { LessonDemo } from './lesson/LessonDemo';
import { ProblemSection } from './problem/ProblemSection';
import { ValueSection } from './value/ValueSection';
import './landing.css';

/** Marketing demos never write real learner history or guardian approvals. */
export function Landing({ locale, start, tutor = { kind: 'visitor' }, onNavigate, onSecondary }: { locale: Locale; start: StartAction; tutor?: TutorAction; onNavigate?: Navigate; onSecondary?: () => void }) {
  const copy = siteCopy(locale), l = copy.landingV2, id = useId();
  const [age, setAge] = useState(0);
  const [approved, setApproved] = useState(false);
  const currentAge = l.ages[age] ?? l.ages[0]!;
  return <div className="lf-site-page lf-landing" data-screen="landing">
    <Hero locale={locale} start={start} tutor={tutor} onNavigate={onNavigate} onSecondary={onSecondary} />
    <ProblemSection locale={locale} />
    <ValueSection locale={locale} />
    <LessonDemo locale={locale} start={start} onNavigate={onNavigate} />
    <BoardsSection locale={locale} />
    <section className="lf-landing-family" data-section aria-labelledby={`${id}-family-title`}>
      <div className="lf-landing-family-preview"><div className="lf-landing-preview-title"><h3 data-copy-role="heading">{l.familyPreview}</h3><span className="lf-landing-example" data-copy-role="body">{l.example}</span></div>
        <div className="lf-landing-family-story"><strong data-copy-role="body">{l.familyStory}</strong><p data-copy-role="body">{l.familyReflection}</p></div>
        <div className="lf-landing-family-task"><div><strong data-copy-role="body">{l.task}</strong><p className="lf-site-note" data-copy-role="body">{l.taskReward}</p></div><Button size="sm" disabled={approved} onClick={() => setApproved(true)}>{approved ? l.approved : l.approve}</Button></div>
        <div className="lf-landing-family-goal"><strong data-copy-role="body">{l.goal}</strong><output data-copy-role="data">{approved ? 70 : 60} / 100</output><progress max={100} value={approved ? 70 : 60} aria-label={l.goal} /><span data-copy-role="body">{l.simulation}</span></div>
        <p role="status" className="lf-site-note" data-copy-role="body">{approved ? l.approvalDemo : l.familyDemo}</p></div>
      <div className="lf-landing-copy"><h2 id={`${id}-family-title`} data-copy-role="heading">{l.familyTitle}</h2><p data-copy-role="body">{l.familyBody}</p><MarketingArt scene="families" locale={locale} compact /></div>
    </section>
    <section className="lf-landing-path" data-section aria-labelledby={`${id}-path-title`}><h2 id={`${id}-path-title`} data-copy-role="heading">{l.pathTitle}</h2>
      <div className="lf-landing-ages" data-uniform="collection" role="group" aria-label={l.pathTitle}>{l.ages.map((item, index) => <button type="button" key={item.range} aria-pressed={age === index} onClick={() => setAge(index)}><span data-copy-role="data">{item.range}</span><strong data-copy-role="heading">{item.title}</strong></button>)}</div><p role="status" data-copy-role="body">{currentAge.body}</p>
    </section>
    <section className="lf-landing-faq" data-section aria-labelledby={`${id}-faq-title`}><h2 id={`${id}-faq-title`} data-copy-role="heading">{l.faqTitle}</h2><div>{l.faq.map(item => <details key={item.question}><summary data-copy-role="heading">{item.question}<span aria-hidden="true">+</span></summary><p data-copy-role="body">{item.answer}</p></details>)}</div></section>
    <section className="lf-landing-closing" data-section><h2 data-copy-role="heading">{l.closingTitle}</h2><StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="landing-closing" /></section>
  </div>;
}
