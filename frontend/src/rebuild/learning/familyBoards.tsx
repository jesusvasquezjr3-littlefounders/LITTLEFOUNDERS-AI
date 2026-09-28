import { useMemo, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { AnswerChoice, Button, ChoiceChip, RadioGroup, Stepper } from '../design/controls';
import { familyCopy } from './familyCopy';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { BoardShell, GradedFoot, MoveToChoice, useLessonMentor, useSegmentGrade, ViewedFoot, type OnGradeSegment } from './segmentKit';
import './familyBoards.css';
import { TeachingChart } from './charts/TeachingChart';

/*
 * GAP-FIX-R1 learning: the first-release logic and money boards (Appendix P
 * Part 8: L1, L5, L6, L10, L12, $1, $2, $9, $10, $11), the v2 story boards
 * (B.9) and the Mentor-voiced turns (B.8, B.11). Every board follows the
 * Bible 05 anatomy through `BoardShell`, offers a tap and keyboard path for
 * every action (buttons, never drag-only), a "Move to" choice for regions and
 * bins, and sends only ids and integers to Core, which grades against its
 * private rubric. The browser never sees which answer is right.
 */

type Seg<T extends LessonClientSegment['type']> = Extract<LessonClientSegment, { type: T }>;
interface BoardProps<T extends LessonClientSegment['type']> {
  document: LessonClientDocument; segment: Seg<T>; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}

/* L1: turn over exactly the cards that could break the rule. */
export function RuleCardsBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.rule-checker.v2'>) {
  const t = familyCopy[document.locale];
  const [flipped, setFlipped] = useState<string[]>([]);
  const grading = useSegmentGrade(segment.id, onGrade);
  const toggle = (id: string) => { grading.reset(); setFlipped((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  return <BoardShell screen="rule-cards" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={flipped.length > 0} sequence={sequence} onCheck={() => grading.check({ flipped })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-rule`}>
      <h2 id={`${segment.id}-rule`} data-copy-role="heading">{t.rule}</h2>
      <p className="lf-family-rule" data-copy-role="prompt">{segment.payload.rule}</p>
      <h3 data-copy-role="heading">{t.cards}</h3>
      <div className="lf-rule-cards" role="group" aria-label={t.cards}>
        {segment.payload.cards.map((card) => {
          const on = flipped.includes(card.id);
          return <button key={card.id} type="button" className={`lf-rule-card${on ? ' lf-rule-card--flipped' : ''}`} aria-pressed={on}
            disabled={grading.pending || grading.met} onClick={() => toggle(card.id)}>
            <span className="lf-rule-card-face" data-copy-role="option">{card.face}</span>
            <span className="lf-rule-card-state" data-copy-role="body">{on ? t.flipped : t.flip}</span>
          </button>;
        })}
      </div>
    </section>
  </BoardShell>;
}

/* L5: place items in an Euler diagram drawn in its declared relation. */
type Region = 'first' | 'second' | 'both' | 'neither';
export function EulerBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.euler.v2'>) {
  const t = familyCopy[document.locale];
  const { relation, sets, items } = segment.payload;
  const [placed, setPlaced] = useState<Record<string, Region>>({});
  const grading = useSegmentGrade(segment.id, onGrade);
  const allowed: Region[] = relation === 'subset' ? ['second', 'both', 'neither'] : relation === 'disjoint' ? ['first', 'second', 'neither'] : ['first', 'second', 'both', 'neither'];
  const regionLabel = (region: Region) => region === 'first' ? t.onlyIn.replace('{set}', sets[0].label) : region === 'second' ? t.onlyIn.replace('{set}', sets[1].label)
    : region === 'both' ? (relation === 'subset' ? sets[0].label : t.both) : t.neither;
  const complete = items.every((item) => placed[item.id] !== undefined);
  const summary = `${t.diagram}. ${allowed.map((region) => `${regionLabel(region)}: ${items.filter((item) => placed[item.id] === region).map((item) => item.label).join(', ') || '0'}`).join('. ')}`;
  const inRegion = (region: Region) => items.filter((item) => placed[item.id] === region);
  return <BoardShell screen="euler" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete} sequence={sequence} onCheck={() => grading.check({ placements: placed })} />}>
    <section className="lf-learning-board lf-family-board" aria-label={t.diagram}>
      <div className={`lf-euler lf-euler--${relation}`} role="img" aria-label={summary}>
        <svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">
          {relation === 'subset' ? <>
            <ellipse cx="160" cy="90" rx="150" ry="84" className="lf-euler-set lf-euler-set--second" />
            <ellipse cx="160" cy="98" rx="70" ry="44" className="lf-euler-set lf-euler-set--first" />
          </> : relation === 'disjoint' ? <>
            <circle cx="80" cy="90" r="72" className="lf-euler-set lf-euler-set--first" />
            <circle cx="240" cy="90" r="72" className="lf-euler-set lf-euler-set--second" />
          </> : <>
            <circle cx="120" cy="90" r="80" className="lf-euler-set lf-euler-set--first" />
            <circle cx="200" cy="90" r="80" className="lf-euler-set lf-euler-set--second" />
          </>}
        </svg>
        <div className="lf-euler-labels" aria-hidden="true">
          <span className="lf-euler-set-label lf-euler-set-label--first" data-copy-role="data">{sets[0].label}</span>
          <span className="lf-euler-set-label lf-euler-set-label--second" data-copy-role="data">{sets[1].label}</span>
        </div>
      </div>
      <div className="lf-euler-regions">
        {allowed.map((region) => <div key={region} className={`lf-euler-region lf-euler-region--${region}`}>
          <strong data-copy-role="option">{regionLabel(region)}</strong>
          <span data-copy-role="data">{inRegion(region).map((item) => item.label).join(', ')}</span>
        </div>)}
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.pickBin}>
      {items.map((item) => <MoveToChoice key={item.id} locale={document.locale} label={item.label} value={placed[item.id] ?? null}
        disabled={grading.pending || grading.met} options={allowed.map((region) => ({ value: region, label: regionLabel(region) }))}
        onChange={(region) => { grading.reset(); setPlaced((current) => ({ ...current, [item.id]: region })); }} />)}
    </section>
  </BoardShell>;
}

/* L6 / $9: walk a flowchart once per scenario; Core grades the path and the outcome. */
export function FlowchartBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.flowchart.v2' | 'money.spend-decision.v2'>) {
  const t = familyCopy[document.locale];
  const { start, nodes, scenarios } = segment.payload;
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const [paths, setPaths] = useState<Record<string, string[]>>(() => Object.fromEntries(scenarios.map((scenario) => [scenario.id, [start]])));
  const [active, setActive] = useState(scenarios[0]!.id);
  const [showAll, setShowAll] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const path = paths[active]!;
  const current = byId.get(path.at(-1)!)!;
  const done = (scenarioId: string) => byId.get(paths[scenarioId]!.at(-1)!)?.kind === 'outcome';
  const step = (next: string | undefined) => { if (!next) return; grading.reset(); setPaths((value) => ({ ...value, [active]: [...value[active]!, next] })); };
  const restart = () => { grading.reset(); setPaths((value) => ({ ...value, [active]: [start] })); };
  return <BoardShell screen={segment.type === 'money.spend-decision.v2' ? 'spend-decision' : 'flowchart'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={scenarios.every((scenario) => done(scenario.id))} sequence={sequence}
      onCheck={() => grading.check({ paths })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-case`}>
      {scenarios.length > 1 ? <div className="lf-flow-cases" role="group" aria-label={t.caseLabel}>
        {scenarios.map((scenario) => <ChoiceChip key={scenario.id} selected={active === scenario.id} onToggle={() => setActive(scenario.id)}>{scenario.label}</ChoiceChip>)}
      </div> : null}
      <h2 id={`${segment.id}-case`} data-copy-role="heading">{scenarios.find((scenario) => scenario.id === active)!.label}</h2>
      <ol className="lf-flow-path" aria-label={t.chart}>
        {path.map((nodeId, index) => {
          const node = byId.get(nodeId)!;
          const next = path[index + 1];
          return <li key={`${nodeId}-${index}`} className={`lf-flow-node lf-flow-node--${node.kind}`}>
            <span data-copy-role="body">{node.label}</span>
            {next ? <b data-copy-role="data">{next === node.yes ? t.yes : t.no}</b> : null}
          </li>;
        })}
      </ol>
      <div className="lf-learning-actions" aria-live="polite">
        {current.kind === 'question'
          ? <><Button variant="sky" disabled={grading.pending || grading.met} onClick={() => step(current.yes)}>{t.yes}</Button>
            <Button variant="berry" disabled={grading.pending || grading.met} onClick={() => step(current.no)}>{t.no}</Button></>
          : <p data-copy-role="body"><strong>{t.result}:</strong> {current.label}</p>}
        <Button disabled={path.length === 1 || grading.pending || grading.met} onClick={restart}>{t.startOver}</Button>
      </div>
      <Button onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>{t.whole}</Button>
      {showAll ? <table className="lf-flow-table"><tbody>
        {nodes.map((node) => <tr key={node.id}><th scope="row" data-copy-role="body">{node.label}</th>
          <td data-copy-role="data">{node.kind === 'question' ? `${t.yes}: ${byId.get(node.yes!)!.label} · ${t.no}: ${byId.get(node.no!)!.label}` : t.result}</td></tr>)}
      </tbody></table> : null}
    </section>
  </BoardShell>;
}

/* L10 / $10: sort each item into a bin (one is "it depends") and say why. */
export function SortBinsBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.sort-by-rule.v2' | 'money.needs-wants.v2'>) {
  const t = familyCopy[document.locale];
  const { bins, items, reasons } = segment.payload;
  const [bin, setBin] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const grading = useSegmentGrade(segment.id, onGrade);
  const complete = items.every((item) => bin[item.id] && reason[item.id]);
  const locked = grading.pending || grading.met;
  return <BoardShell screen={segment.type === 'money.needs-wants.v2' ? 'needs-wants' : 'sort-bins'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete} sequence={sequence}
      onCheck={() => grading.check({ placements: Object.fromEntries(items.map((item) => [item.id, { bin: bin[item.id], reason: reason[item.id] }])) })} />}>
    <section className="lf-learning-board lf-family-board" aria-label={t.bins}>
      <div className="lf-sort-bins">
        {bins.map((value) => <div key={value.id} className={`lf-sort-bin${value.id === segment.payload.depends_bin_id ? ' lf-sort-bin--depends' : ''}`}>
          <h2 data-copy-role="heading">{value.label}</h2>
          <ul>{items.filter((item) => bin[item.id] === value.id).map((item) => <li key={item.id} data-copy-role="option">{item.label}</li>)}</ul>
        </div>)}
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.pickBin}>
      {items.map((item) => <div key={item.id} className="lf-sort-item">
        <MoveToChoice locale={document.locale} label={item.label} value={bin[item.id] ?? null} disabled={locked}
          options={bins.map((value) => ({ value: value.id, label: value.label }))}
          onChange={(value) => { grading.reset(); setBin((current) => ({ ...current, [item.id]: value })); }} />
        {bin[item.id] ? <RadioGroup legend={t.why} name={`${segment.id}-${item.id}-why`} disabled={locked} value={reason[item.id] ?? null}
          options={reasons.map((value) => ({ value: value.id, label: value.label }))}
          onValueChange={(value) => { grading.reset(); setReason((current) => ({ ...current, [item.id]: value })); }} /> : null}
      </div>)}
    </section>
  </BoardShell>;
}

/* L12 / $11: flag the scams; genuine messages are always in the set. */
export function MessageListBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.scam-spotter.v2' | 'money.scam-check.v2'>) {
  const t = familyCopy[document.locale];
  const [flagged, setFlagged] = useState<string[]>([]);
  const grading = useSegmentGrade(segment.id, onGrade);
  const set = (id: string, scam: boolean) => { grading.reset(); setFlagged((current) => scam ? [...new Set([...current, id])] : current.filter((value) => value !== id)); };
  return <BoardShell screen={segment.type === 'money.scam-check.v2' ? 'scam-check' : 'scam-spotter'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck sequence={sequence} onCheck={() => grading.check({ flagged })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-messages`}>
      <h2 id={`${segment.id}-messages`} data-copy-role="heading">{t.messages}</h2>
      <ul className="lf-message-list">
        {segment.payload.messages.map((message) => {
          const scam = flagged.includes(message.id);
          return <li key={message.id} className={`lf-message${scam ? ' lf-message--flagged' : ''}`}>
            <span className="lf-message-from" data-copy-role="data">{t.from}: {message.sender}</span>
            <p data-copy-role="body">{message.text}</p>
            <div className="lf-message-actions" role="group" aria-label={message.sender}>
              <Button variant={scam ? 'berry' : 'secondary'} aria-pressed={scam} disabled={grading.pending || grading.met} onClick={() => set(message.id, true)}>{t.scam}</Button>
              <Button variant={!scam ? 'mint' : 'secondary'} aria-pressed={!scam} disabled={grading.pending || grading.met} onClick={() => set(message.id, false)}>{t.notScam}</Button>
            </div>
          </li>;
        })}
      </ul>
    </section>
  </BoardShell>;
}

/* $1 / $2: coins and bills in integer minor units; the total is always the sum of the tray. */
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
export function CoinTrayBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.coin-tray.v2' | 'money.making-change.v2'>) {
  const t = familyCopy[document.locale];
  const { denominations, currency } = segment.payload;
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(denominations.map((d) => [String(d.value_minor), 0])));
  const grading = useSegmentGrade(segment.id, onGrade);
  const format = useMemo(() => {
    const money = new Intl.NumberFormat(document.locale, { style: 'currency', currency: localCurrency[document.locale] });
    const coins = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 0 });
    return (minor: number) => currency === 'local' ? money.format(minor / 100) : coins.format(minor);
  }, [document.locale, currency]);
  const total = denominations.reduce((sum, d) => sum + d.value_minor * (counts[String(d.value_minor)] ?? 0), 0);
  const change = segment.type === 'money.making-change.v2' ? segment.payload : null;
  return <BoardShell screen={change ? 'making-change' : 'coin-tray'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={total > 0} sequence={sequence} onCheck={() => grading.check({ counts })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-tray`}>
      <h2 id={`${segment.id}-tray`} data-copy-role="heading">{t.tray}</h2>
      {change ? <dl className="lf-coin-facts">
        <div><dt data-copy-role="body">{t.price}</dt><dd data-copy-role="data">{format(change.price_minor)}</dd></div>
        <div><dt data-copy-role="body">{t.paid}</dt><dd data-copy-role="data">{format(change.paid_minor)}</dd></div>
      </dl> : null}
      <div className="lf-coin-tray">
        {denominations.map((d) => <div key={d.value_minor} className={`lf-coin lf-coin--${d.kind}`}>
          <Stepper label={format(d.value_minor)} valuePlacement="label" min={0} max={d.available} value={counts[String(d.value_minor)] ?? 0}
            disabled={grading.pending || grading.met} labels={{ decrease: t.fewer, increase: t.more }}
            onValueChange={(value) => { grading.reset(); setCounts((current) => ({ ...current, [String(d.value_minor)]: value })); }} />
        </div>)}
      </div>
      <p className="lf-coin-total" role="status" data-copy-role="body"><strong>{change ? t.change : t.total}:</strong> {format(total)}</p>
    </section>
  </BoardShell>;
}

/* B.9: story decisions. Core grades the choice id and journals the decision. */
export function StoryChoiceBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'story.branch.v2' | 'story.dialogue-choice.v2' | 'story.would-you-rather.v2'>) {
  const [choice, setChoice] = useState<string | null>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const options = segment.type === 'story.dialogue-choice.v2' ? segment.payload.replies : segment.payload.options;
  return <BoardShell screen={segment.type.replace('.v2', '').replace('.', '-')} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={choice !== null} sequence={sequence} onCheck={() => grading.check({ choice })} />}>
    <section className="lf-learning-board lf-family-board lf-story-board">
      {segment.type === 'story.branch.v2' ? <p className="lf-story-scene" data-copy-role="narrative">{segment.payload.scene}</p> : null}
      {segment.type === 'story.dialogue-choice.v2' ? <div className="lf-speech-plate"><span className="lf-speech-plate-name" data-copy-role="data">{segment.payload.speaker}</span>
        <p data-copy-role="narrative">{segment.payload.line}</p></div> : null}
      <div className={`lf-story-options${segment.type === 'story.would-you-rather.v2' ? ' lf-story-options--pair' : ''}`} role="group" aria-label={segment.prompt}>
        {options.map((option) => <AnswerChoice key={option.id} label={option.label} selected={choice === option.id} disabled={grading.pending || grading.met}
          onSelect={() => { grading.reset(); setChoice(option.id); }} />)}
      </div>
    </section>
  </BoardShell>;
}

/* B.8: one Mentor turn in the compact stage's speech plate (intro, transition or wrap). */
export function MentorTurnBoard({ document, segment, onBack, sequence }: BoardProps<'voice.mentor-turn.v2'>) {
  const mentor = useLessonMentor();
  return <BoardShell screen={`mentor-${segment.payload.role}`} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished foot={<ViewedFoot locale={document.locale} sequence={sequence} />}>
    <div className="lf-speech-plate lf-mentor-turn" role="note">
      {mentor ? <span className="lf-speech-plate-name" data-copy-role="data">{mentor.name}</span> : null}
      <p data-copy-role="mentor">{segment.payload.line}</p>
    </div>
  </BoardShell>;
}

/* B.11: the Mentor's own misjudgment, then the recovery, stepped one plate at a time. */
export function MentorEpisodeBoard({ document, segment, onBack, sequence }: BoardProps<'voice.mentor-episode.v2'>) {
  const t = familyCopy[document.locale];
  const mentor = useLessonMentor();
  const lines = [segment.payload.setup, segment.payload.misjudgment, segment.payload.recovery];
  const [shown, setShown] = useState(1);
  return <BoardShell screen="mentor-episode" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={shown === lines.length} foot={<ViewedFoot locale={document.locale} sequence={sequence} ready={shown === lines.length} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-episode`}>
      <h2 id={`${segment.id}-episode`} data-copy-role="heading">{t.whatHappened}</h2>
      <ol className="lf-mentor-episode" aria-live="polite">
        {lines.slice(0, shown).map((line, index) => <li key={index} className="lf-speech-plate">
          {mentor ? <span className="lf-speech-plate-name" data-copy-role="data">{mentor.name}</span> : null}
          <p data-copy-role="mentor">{line}</p>
        </li>)}
      </ol>
      {shown < lines.length ? <Button variant="sky" onClick={() => setShown((value) => value + 1)}>{t.next}</Button> : null}
    </section>
  </BoardShell>;
}

/* B.7 part 1: a teaching chart, explored or with one question read off it (the acceptable option is private to Core). */
export function ChartBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'visual.chart.v2'>) {
  const [choice, setChoice] = useState<string | null>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const question = segment.payload.question;
  return <BoardShell screen={`chart-${segment.visual.type}`} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={question ? grading.met : true} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    foot={question ? <GradedFoot locale={document.locale} grading={grading} canCheck={choice !== null} sequence={sequence} onCheck={() => grading.check({ choice })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} />}>
    <section className="lf-learning-board lf-family-board">
      <TeachingChart kind={segment.visual.type} data={segment.payload.data} title={segment.payload.title} locale={document.locale} />
    </section>
    {question ? <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-question`}>
      <p id={`${segment.id}-question`} data-copy-role="prompt">{question.prompt}</p>
      <div className="lf-story-options" role="group" aria-labelledby={`${segment.id}-question`}>
        {question.options.map((option) => <AnswerChoice key={option.id} label={option.label} selected={choice === option.id} disabled={grading.pending || grading.met}
          onSelect={() => { grading.reset(); setChoice(option.id); }} />)}
      </div>
    </section> : null}
  </BoardShell>;
}
