import { MarketingArt } from './MarketingArt';
import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, IconButton } from '../design/controls';
import { MentorCast, SiteLink, StartButton, siteCopy, type Navigate, type StartAction } from './blocks';
import './landing.css';

/** Marketing demos never write real learner history or guardian approvals. */
export function Landing({ locale, start, onNavigate }: { locale: Locale; start: StartAction; onNavigate?: Navigate; onSecondary?: () => void }) {
  const copy = siteCopy(locale), l = copy.landingV2, id = useId();
  const [topic, setTopic] = useState(0), [answer, setAnswer] = useState<number | null>(null);
  const [reason, setReason] = useState<number | null>(null), [age, setAge] = useState(0);
  const [saved, setSaved] = useState(2), [approved, setApproved] = useState(false);
  const currentTopic = l.topics[topic] ?? l.topics[0]!;
  const currentAge = l.ages[age] ?? l.ages[0]!;
  return <div className="lf-site-page lf-landing" data-screen="landing">
    <section className="lf-landing-hero" data-section data-layout="hero">
      <div className="lf-landing-copy"><h1 data-copy-role="brand">{l.title}{' '}<span>{l.titleAccent}</span></h1>
        <p className="lf-site-lead" data-copy-role="body">{l.lead}</p>
        <div className="lf-site-cta-row"><StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="landing-hero" />
          <a className="lf-button lf-button--secondary lf-button--lg" href={`#${id}-learn`} data-copy-role="action">{l.tryAction}</a></div>
        <p className="lf-site-note" data-copy-role="body">{l.note}</p></div>
      <img className="lf-landing-family-art" src="/rebuild/landing/family.webp" alt={l.heroAlt} width={1120} height={1400} data-asset-id="site.landing.family" data-slot="site.hero" />
    </section>
    <section id={`${id}-learn`} className="lf-landing-learning" data-section aria-labelledby={`${id}-learn-title`}>
      <h2 id={`${id}-learn-title`} data-copy-role="heading">{l.learnTitle}</h2>
      <div className="lf-landing-learning-layout"><div className="lf-landing-topics" role="group" aria-label={l.learnTitle}>
        {l.topics.map((item, index) => <button key={item.title} type="button" className="lf-landing-topic" aria-pressed={topic === index} aria-controls={`${id}-demo`} onClick={() => { setTopic(index); setAnswer(null); }}>
          <span className="lf-landing-number" data-copy-role="data">0{index + 1}</span><span><strong data-copy-role="heading">{item.title}</strong><span data-copy-role="body">{item.body}</span></span></button>)}
      </div><div id={`${id}-demo`} className="lf-landing-demo" data-demo={topic}>
        <span className="lf-landing-example" data-copy-role="body">{l.example}</span><h3 data-copy-role="heading">{currentTopic.question}</h3>
        {topic === 0 ? <><div className="lf-landing-savings"><img src="/rebuild/landing/savings.svg" alt="" width={112} height={112} data-asset-id="site.landing.savings" />
          <div className="lf-landing-stepper"><IconButton glyph="minus" label={l.removeCoin} disabled={saved === 0} onClick={() => setSaved(saved - 1)} /><output data-copy-role="data" aria-live="polite">{saved} / 10</output><IconButton glyph="plus" label={l.addCoin} disabled={saved === 10} onClick={() => setSaved(saved + 1)} /></div></div>
          <progress max={10} value={saved} aria-label={l.topics[0]!.title} /><p data-copy-role="body">{l.saveHint}</p></> : <>
          <img className="lf-landing-demo-art" src={topic === 1 ? '/rebuild/landing/logic.svg' : '/rebuild/landing/ideas.svg'} alt="" width={144} height={96} data-asset-id={topic === 1 ? 'site.landing.logic' : 'site.landing.ideas'} />
          {topic === 1 ? <p className="lf-landing-sequence" data-copy-role="data">2 → 4 → 6 → ?</p> : null}
          <div className="lf-landing-answers" role="group" aria-label={currentTopic.question}>{currentTopic.options.map((option, index) => <Button key={option} variant={answer === index ? 'brand' : 'secondary'} aria-pressed={answer === index} onClick={() => setAnswer(index)}>{option}</Button>)}</div>
          <p role="status" data-copy-role="body">{answer === null ? l.tryHint : currentTopic.feedback[answer]}</p></>}
        <span className="lf-site-note" data-copy-role="body">{l.simulation}</span>
      </div></div>
    </section>
    <section className="lf-landing-mentor" data-section aria-labelledby={`${id}-mentor-title`}>
      <div className="lf-landing-copy"><h2 id={`${id}-mentor-title`} data-copy-role="heading">{l.mentorTitle}</h2><p data-copy-role="body">{l.mentorBody}</p>
      <div className="lf-landing-reasoning"><span className="lf-landing-example" data-copy-role="body">{l.reasonLabel}</span><h3 data-copy-role="prompt">{l.reasonQuestion}</h3>
        <div className="lf-landing-reasons" role="group" aria-label={l.reasonQuestion}>{l.reasons.map((item, index) => <Button key={item.label} variant={reason === index ? 'brand' : 'secondary'} aria-pressed={reason === index} onClick={() => setReason(index)}>{item.label}</Button>)}</div>
        <p role="status" data-copy-role="body">{reason === null ? l.reasonHint : l.reasons[reason]?.feedback ?? l.reasonHint}</p></div></div>
      <div className="lf-landing-mentor-visual"><MarketingArt scene="mentorsHow" locale={locale} compact /><MentorCast label={copy.site.mentorsLabel} size="md" /></div>
    </section>
    <section className="lf-landing-family" data-section aria-labelledby={`${id}-family-title`}>
      <div className="lf-landing-family-preview"><div className="lf-landing-preview-title"><h3 data-copy-role="heading">{l.familyPreview}</h3><span className="lf-landing-example" data-copy-role="body">{l.example}</span></div>
        <div className="lf-landing-family-story"><strong data-copy-role="body">{l.familyStory}</strong><p data-copy-role="body">{l.familyReflection}</p></div>
        <div className="lf-landing-family-task"><div><strong data-copy-role="body">{l.task}</strong><p className="lf-site-note" data-copy-role="body">{l.taskReward}</p></div><Button size="sm" disabled={approved} onClick={() => setApproved(true)}>{approved ? l.approved : l.approve}</Button></div>
        <div className="lf-landing-family-goal"><strong data-copy-role="body">{l.goal}</strong><output data-copy-role="data">{approved ? 70 : 60} / 100</output><progress max={100} value={approved ? 70 : 60} aria-label={l.goal} /><span data-copy-role="body">{l.simulation}</span></div>
        <p role="status" className="lf-site-note" data-copy-role="body">{approved ? l.approvalDemo : l.familyDemo}</p></div>
      <div className="lf-landing-copy"><h2 id={`${id}-family-title`} data-copy-role="heading">{l.familyTitle}</h2><p data-copy-role="body">{l.familyBody}</p><MarketingArt scene="families" locale={locale} compact /><SiteLink href="/families" onNavigate={onNavigate}>{l.familyAction}</SiteLink></div>
    </section>
    <section className="lf-landing-path" data-section aria-labelledby={`${id}-path-title`}><h2 id={`${id}-path-title`} data-copy-role="heading">{l.pathTitle}</h2>
      <div className="lf-landing-ages" data-uniform="collection" role="group" aria-label={l.pathTitle}>{l.ages.map((item, index) => <button type="button" key={item.range} aria-pressed={age === index} onClick={() => setAge(index)}><span data-copy-role="data">{item.range}</span><strong data-copy-role="heading">{item.title}</strong></button>)}</div><p role="status" data-copy-role="body">{currentAge.body}</p>
    </section>
    <section className="lf-landing-faq" data-section aria-labelledby={`${id}-faq-title`}><h2 id={`${id}-faq-title`} data-copy-role="heading">{l.faqTitle}</h2><div>{l.faq.map(item => <details key={item.question}><summary data-copy-role="heading">{item.question}<span aria-hidden="true">+</span></summary><p data-copy-role="body">{item.answer}</p></details>)}</div></section>
    <section className="lf-landing-closing" data-section><h2 data-copy-role="heading">{l.closingTitle}</h2><StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="landing-closing" /></section>
  </div>;
}
