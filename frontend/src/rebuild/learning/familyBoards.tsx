import { useMemo, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { AnswerChoice, Button, ChoiceChip, RadioGroup, SegmentedControl, Stepper } from '../design/controls';
import { familyCopy } from './familyCopy';
import { namedFeedback } from './namedFeedback';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { BoardShell, GradedFoot, MoveToChoice, NarrationControl, NumberAnswer, playerCopy, useDragPlace, useLessonMentor, useSegmentGrade, ViewedFoot, type OnGradeSegment } from './segmentKit';
import { CoinGroupsVisual, SortBinsVisual, TextCardsVisual, VennVisual, type VennRegionKey } from './pizarron';
import './familyBoards.css';
import { TeachingChart } from './charts/TeachingChart';
import { FlowchartBuildBoard } from './buildBoards';
import { eulerRegions, sortPhaseBins, type FlowchartPayload } from './v2SegmentFamilies.generated';

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

/* L1: turn over exactly the cards that could break the rule. The cards are the shared Pizarrón text cards (B.7). */
export function RuleCardsBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.rule-checker.v2'>) {
  const t = familyCopy[document.locale];
  const [flipped, setFlipped] = useState<string[]>([]);
  const grading = useSegmentGrade(segment.id, onGrade);
  const toggle = (id: string) => { grading.reset(); setFlipped((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  return <BoardShell screen="rule-cards" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setFlipped([]); }} resetDisabled={flipped.length === 0 || grading.pending || grading.met}
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'rule-cards')} feedback={segment.feedback} canCheck={flipped.length > 0} sequence={sequence} onCheck={() => grading.check({ flipped })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-rule`}>
      <h2 id={`${segment.id}-rule`} data-copy-role="heading">{t.rule}</h2>
      <p className="lf-family-rule" data-copy-role="prompt">{segment.payload.rule}</p>
      <TextCardsVisual label={`${t.cards}: ${segment.payload.cards.map((card) => card.face).join(', ')}`}
        cards={segment.payload.cards.map((card) => ({ id: card.id, title: card.face, lines: [], marked: flipped.includes(card.id) }))} />
    </section>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-cards`}>
      <h3 id={`${segment.id}-cards`} data-copy-role="heading">{t.cards}</h3>
      {/* Each card is the shared pick chip: a turned card gains a check, never colour alone (02 rule 23). */}
      <div className="lf-rule-cards" role="group" aria-labelledby={`${segment.id}-cards`}>
        {segment.payload.cards.map((card) => <ChoiceChip key={card.id} selected={flipped.includes(card.id)}
          disabled={grading.pending || grading.met} onToggle={() => toggle(card.id)}>{card.face}</ChoiceChip>)}
      </div>
    </section>
  </BoardShell>;
}

/*
 * L5 (GAP-FIX-R4, Appendix P L5 "Place items; pick the diagram that matches a
 * sentence"; graded on the item->region map, the region occupancy flags and the
 * chosen conclusion): the learner may first choose which of the three diagrams
 * matches the sentence, then drags each item into a region of the shared
 * Pizarrón Euler picture (VennVisual, B.7) or taps it then its region, or uses
 * the "Move to" menu (Bible 05 §4); then flags the regions that hold
 * something, and for a syllogism says whether the conclusion must, might or
 * cannot be true. Core holds every answer.
 */
type Region = 'first' | 'second' | 'both' | 'neither';
type Relation = 'overlap' | 'subset' | 'disjoint';
const REGION_KEY: Record<Region, VennRegionKey> = { first: 'left', second: 'right', both: 'both', neither: 'neither' };
const KEY_REGION: Record<VennRegionKey, Region> = { left: 'first', right: 'second', both: 'both', neither: 'neither' };
export function EulerBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.euler.v2'>) {
  const t = familyCopy[document.locale];
  const { sets, items } = segment.payload;
  const choose = segment.payload.choose_relation === true;
  const [relation, setRelation] = useState<Relation | null>(segment.payload.relation ?? null);
  const [placed, setPlaced] = useState<Record<string, Region>>({});
  const [occupied, setOccupied] = useState<Region[]>([]);
  const [conclusion, setConclusion] = useState<'necessarily' | 'possibly' | 'never' | null>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const allowed: Region[] = relation ? eulerRegions(relation) : [];
  const place = (item: string, region: Region) => {
    if (!allowed.includes(region)) return;
    grading.reset();
    setPlaced((current) => ({ ...current, [item]: region }));
  };
  const dnd = useDragPlace<Region>(place, locked || relation === null);
  const pick = (next: Relation) => {
    grading.reset();
    setRelation(next);
    const regions = eulerRegions(next);
    setPlaced((current) => Object.fromEntries(Object.entries(current).filter(([, region]) => regions.includes(region))));
    setOccupied((current) => current.filter((region) => regions.includes(region)));
  };
  const regionLabel = (region: Region) => region === 'first' ? t.onlyIn.replace('{set}', sets[0].label) : region === 'second' ? t.onlyIn.replace('{set}', sets[1].label)
    : region === 'both' ? (relation === 'subset' ? sets[0].label : t.both) : t.neither;
  const inRegion = (region: Region) => items.filter((item) => placed[item.id] === region).map((item) => item.label);
  const complete = relation !== null && items.every((item) => placed[item.id] !== undefined) && (!segment.payload.conclusion || conclusion !== null);
  const changed = (choose && relation !== null) || Object.keys(placed).length > 0 || occupied.length > 0 || conclusion !== null;
  const reset = () => { grading.reset(); setRelation(segment.payload.relation ?? null); setPlaced({}); setOccupied([]); setConclusion(null); dnd.clear(); };
  const answer = { placements: placed, ...(choose ? { relation } : {}), ...(segment.payload.mark_occupancy ? { occupied } : {}),
    ...(segment.payload.conclusion ? { conclusion } : {}) };
  const relations: Array<{ value: Relation; label: string }> = [
    { value: 'overlap', label: t.relationOverlap }, { value: 'subset', label: t.relationSubset }, { value: 'disjoint', label: t.relationDisjoint }];
  return <BoardShell screen="euler" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'euler')} feedback={segment.feedback} canCheck={complete} sequence={sequence} onCheck={() => grading.check(answer)} />}>
    {choose ? <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-sentence`}>
      <h2 id={`${segment.id}-sentence`} data-copy-role="heading">{t.sentence}</h2>
      <p className="lf-family-rule" data-copy-role="prompt">{segment.payload.sentence}</p>
      <RadioGroup legend={t.pickDiagram} name={`${segment.id}-relation`} disabled={locked} value={relation} options={relations} onValueChange={pick} />
    </section> : null}
    {relation ? <section className="lf-learning-board lf-family-board" aria-label={t.diagram}>
      <VennVisual label={t.diagram} relation={relation} leftLabel={regionLabel('first')} rightLabel={regionLabel('second')} bothLabel={regionLabel('both')}
        neitherLabel={t.neither}
        regions={Object.fromEntries(allowed.map((region) => [REGION_KEY[region], { count: inRegion(region).length ? String(inRegion(region).length) : '', items: inRegion(region) }]))}
        targetProps={(key) => { const region = KEY_REGION[key]; return region && allowed.includes(region) ? dnd.target(region) : undefined; }} />
      <p id={`${segment.id}-drag`} className="lf-visually-hidden" data-copy-role="body">{playerCopy(document.locale).dragHint}</p>
      <div className="lf-drag-chips" role="group" aria-label={t.place} aria-describedby={`${segment.id}-drag`}>
        {items.map((item) => <ChoiceChip key={item.id} {...dnd.chip(item.id)} disabled={locked}>{item.label}</ChoiceChip>)}
        <MoveToChoice locale={document.locale} item={items.find((item) => item.id === dnd.carried) ?? null} disabled={locked}
          options={allowed.map((region) => ({ value: region, label: regionLabel(region) }))}
          onChange={(region) => { if (dnd.carried) place(dnd.carried, region); dnd.clear(); }} />
      </div>
    </section> : null}
    {relation && segment.payload.mark_occupancy ? <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-occupied`}>
      <h3 id={`${segment.id}-occupied`} data-copy-role="heading">{t.occupied}</h3>
      <div className="lf-rule-cards" role="group" aria-labelledby={`${segment.id}-occupied`}>
        {allowed.map((region) => <ChoiceChip key={region} selected={occupied.includes(region)} disabled={locked}
          onToggle={() => { grading.reset(); setOccupied((current) => current.includes(region) ? current.filter((value) => value !== region) : [...current, region]); }}>
          {regionLabel(region)}</ChoiceChip>)}
      </div>
    </section> : null}
    {relation && segment.payload.conclusion ? <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-conclusion`}>
      <h3 id={`${segment.id}-conclusion`} data-copy-role="heading">{t.conclusion}</h3>
      <p className="lf-family-rule" data-copy-role="prompt">{segment.payload.conclusion.statement}</p>
      <RadioGroup legend={t.conclusion} name={`${segment.id}-conclusion-choice`} disabled={locked} value={conclusion}
        options={[{ value: 'necessarily', label: t.necessarily }, { value: 'possibly', label: t.possibly }, { value: 'never', label: t.never }] as const}
        onValueChange={(value) => { grading.reset(); setConclusion(value); }} />
    </section> : null}
  </BoardShell>;
}

/* L6 / $9: walk a flowchart once per scenario, or (13+, GAP-FIX-R2) build one and test it on cases. */
export function FlowchartBoard(props: BoardProps<'logic.flowchart.v2' | 'money.spend-decision.v2'>) {
  return 'mode' in props.segment.payload ? <FlowchartBuildBoard {...props} /> : <WalkFlowchartBoard {...props} />;
}

/* L6 / $9: walk a flowchart once per scenario; Core grades the path and the outcome. */
function WalkFlowchartBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.flowchart.v2' | 'money.spend-decision.v2'>) {
  const t = familyCopy[document.locale];
  const { start, nodes, scenarios } = segment.payload as FlowchartPayload;
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const fresh = () => Object.fromEntries(scenarios.map((scenario) => [scenario.id, [start]]));
  const [paths, setPaths] = useState<Record<string, string[]>>(fresh);
  const [active, setActive] = useState(scenarios[0]!.id);
  const [showAll, setShowAll] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const path = paths[active]!;
  const current = byId.get(path.at(-1)!)!;
  const done = (scenarioId: string) => byId.get(paths[scenarioId]!.at(-1)!)?.kind === 'outcome';
  const step = (next: string | undefined) => { if (!next) return; grading.reset(); setPaths((value) => ({ ...value, [active]: [...value[active]!, next] })); };
  const restart = () => { grading.reset(); setPaths((value) => ({ ...value, [active]: [start] })); };
  const changed = Object.values(paths).some((value) => value.length > 1);
  return <BoardShell screen={segment.type === 'money.spend-decision.v2' ? 'spend-decision' : 'flowchart'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setPaths(fresh()); setActive(scenarios[0]!.id); }} resetDisabled={!changed || grading.pending || grading.met}
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'flowchart-walk')} feedback={segment.feedback} canCheck={scenarios.every((scenario) => done(scenario.id))} sequence={sequence}
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

/*
 * L10 / $10: sort each item into a bin and say why; a bin may be "it depends".
 * GAP-FIX-R4 (Appendix P L10 "the rule changes mid-task"): with a switch, the
 * items after `switch_after` are sorted by the new rule into the second bin
 * set, shown once the first rule's items are sorted. Items are dragged onto
 * the shared Pizarrón bins (SortBinsVisual, B.7), tapped then their bin, or
 * moved with the "Move to" menu.
 */
export function SortBinsBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.sort-by-rule.v2' | 'money.needs-wants.v2'>) {
  const t = familyCopy[document.locale];
  const p = segment.payload;
  const { items, reasons } = p;
  const [bin, setBin] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const switchAt = p.switch_after ?? items.length;
  const firstItems = items.slice(0, switchAt);
  const secondItems = items.slice(switchAt);
  const firstDone = firstItems.every((item) => bin[item.id] && reason[item.id]);
  const phaseBins = (itemId: string) => sortPhaseBins(p, itemId);
  const place = (item: string, target: string) => {
    if (!phaseBins(item).some((value) => value.id === target)) return;
    grading.reset();
    setBin((current) => ({ ...current, [item]: target }));
  };
  const dnd = useDragPlace<string>(place, locked);
  const complete = items.every((item) => bin[item.id] && reason[item.id]);
  const changed = Object.keys(bin).length > 0 || Object.keys(reason).length > 0;
  const visual = (bins: typeof p.bins, phaseItems: typeof items, label: string) => <SortBinsVisual label={label}
    bins={bins.map((value) => ({ id: value.id, label: value.label, marked: value.id === p.depends_bin_id,
      items: phaseItems.filter((item) => bin[item.id] === value.id).map((item) => item.label) }))}
    targetProps={(id) => dnd.target(id)} />;
  const itemControls = (phaseItems: typeof items) => phaseItems.filter((item) => bin[item.id]).map((item) => <div key={item.id} className="lf-sort-item">
    <RadioGroup legend={`${t.why} ${item.label}`} name={`${segment.id}-${item.id}-why`} disabled={locked} value={reason[item.id] ?? null}
      options={reasons.map((value) => ({ value: value.id, label: value.label }))}
      onValueChange={(value) => { grading.reset(); setReason((current) => ({ ...current, [item.id]: value })); }} />
  </div>);
  const chips = (phaseItems: typeof items) => {
    const carried = phaseItems.find((item) => item.id === dnd.carried) ?? null;
    return <div className="lf-drag-chips" role="group" aria-label={t.place} aria-describedby={`${segment.id}-drag`}>
      {phaseItems.map((item) => <ChoiceChip key={item.id} {...dnd.chip(item.id)} disabled={locked}>{item.label}</ChoiceChip>)}
      <MoveToChoice locale={document.locale} item={carried} disabled={locked}
        options={(carried ? phaseBins(carried.id) : []).map((value) => ({ value: value.id, label: value.label }))}
        onChange={(value) => { if (carried) place(carried.id, value); dnd.clear(); }} />
    </div>;
  };
  return <BoardShell screen={segment.type === 'money.needs-wants.v2' ? 'needs-wants' : 'sort-bins'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setBin({}); setReason({}); dnd.clear(); }} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'sort-bins')} feedback={segment.feedback} canCheck={complete} sequence={sequence}
      onCheck={() => grading.check({ placements: Object.fromEntries(items.map((item) => [item.id, { bin: bin[item.id], reason: reason[item.id] }])) })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-bins`}>
      <h2 id={`${segment.id}-bins`} data-copy-role="heading">{t.bins}</h2>
      {p.rule ? <p className="lf-family-rule" data-copy-role="prompt">{p.rule}</p> : null}
      {visual(p.bins, firstItems, p.rule ?? t.bins)}
      <p id={`${segment.id}-drag`} className="lf-visually-hidden" data-copy-role="body">{playerCopy(document.locale).dragHint}</p>
      {chips(firstItems)}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.pickBin}>{itemControls(firstItems)}</section>
    {p.second_bins && secondItems.length > 0 && firstDone ? <>
      <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-new-rule`} aria-live="polite">
        <h2 id={`${segment.id}-new-rule`} data-copy-role="heading">{t.newRule}</h2>
        <p className="lf-family-rule" data-copy-role="prompt">{p.second_rule}</p>
        {visual(p.second_bins, secondItems, p.second_rule ?? t.newRule)}
        {chips(secondItems)}
      </section>
      <section className="lf-learning-control-strip" aria-label={t.pickBin}>{itemControls(secondItems)}</section>
    </> : null}
  </BoardShell>;
}

/* L12 / $11: flag the scams; genuine messages are always in the set. */
export function MessageListBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.scam-spotter.v2' | 'money.scam-check.v2'>) {
  const t = familyCopy[document.locale];
  const [flagged, setFlagged] = useState<string[]>([]);
  const grading = useSegmentGrade(segment.id, onGrade);
  const set = (id: string, scam: boolean) => {
    grading.reset();
    setFlagged((current) => scam ? [...new Set([...current, id])] : current.filter((value) => value !== id));
    // A message called fine again keeps no cue ticks.
    if (!scam) setTicks((current) => (current[id] ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)) : current));
  };
  // L12 (GAP-FIX-R2): "tick which cues fired" per message; stored as a diagnostic beside the flag decision.
  const cueList = segment.payload.cues;
  const [ticks, setTicks] = useState<Record<string, string[]>>({});
  const tick = (message: string, cue: string) => { grading.reset(); setTicks((current) => {
    const now = current[message] ?? [];
    return { ...current, [message]: now.includes(cue) ? now.filter((value) => value !== cue) : [...now, cue] };
  }); };
  const changed = flagged.length > 0 || Object.values(ticks).some((value) => value.length > 0);
  return <BoardShell screen={segment.type === 'money.scam-check.v2' ? 'scam-check' : 'scam-spotter'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setFlagged([]); setTicks({}); }} resetDisabled={!changed || grading.pending || grading.met}
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'scam')} feedback={segment.feedback} canCheck sequence={sequence} onCheck={() => grading.check(cueList ? { flagged, cues: ticks } : { flagged })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-messages`}>
      <h2 id={`${segment.id}-messages`} data-copy-role="heading">{t.messages}</h2>
      <ul className="lf-message-list">
        {segment.payload.messages.map((message) => {
          const scam = flagged.includes(message.id);
          return <li key={message.id} className={`lf-message${scam ? ' lf-message--flagged' : ''}`}>
            <span className="lf-message-from" data-copy-role="data">{message.sender}</span>
            <p data-copy-role="body">{message.text}</p>
            <SegmentedControl className="lf-message-actions" legend={message.sender} legendHidden name={`${segment.id}-${message.id}`} size="compact"
              options={[{ value: 'scam', label: t.scam }, { value: 'safe', label: t.notScam }]} value={scam ? 'scam' : 'safe'}
              disabled={grading.pending || grading.met} onValueChange={(value) => set(message.id, value === 'scam')} />
            {/* GAP-FIX-R4: the cues are what made the learner call it a scam, so they appear once it is flagged. */}
            {cueList && scam ? <div className="lf-message-cues" role="group" aria-label={`${t.cues}: ${message.sender}`}>
              {cueList.map((cue) => <ChoiceChip key={cue.id} selected={(ticks[message.id] ?? []).includes(cue.id)} disabled={grading.pending || grading.met}
                onToggle={() => tick(message.id, cue.id)}>{cue.label}</ChoiceChip>)}
            </div> : null}
          </li>;
        })}
      </ul>
    </section>
  </BoardShell>;
}

/*
 * $1 / $2: coins and bills in integer minor units; the total is always the sum
 * of the tray. GAP-FIX-R4 (Bible 05 §2 and §7 Money): the tray is drawn with
 * the shared Pizarrón coin piles (CoinGroupsVisual, B.7): reward coins with the
 * ridge outline, notes as a simplified token of the same family, one pile per
 * denomination, filling live as the steppers change; for $2 the running
 * count-up sits beside the tray. Never the Wallet's save and spend hues.
 */
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
export function CoinTrayBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.coin-tray.v2' | 'money.making-change.v2'>) {
  const t = familyCopy[document.locale];
  const { denominations, currency } = segment.payload;
  const empty = () => Object.fromEntries(denominations.map((d) => [String(d.value_minor), 0]));
  const [counts, setCounts] = useState<Record<string, number>>(empty);
  const grading = useSegmentGrade(segment.id, onGrade);
  const format = useMemo(() => {
    const money = new Intl.NumberFormat(document.locale, { style: 'currency', currency: localCurrency[document.locale] });
    const coins = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 0 });
    return (minor: number) => currency === 'local' ? money.format(minor / 100) : coins.format(minor);
  }, [document.locale, currency]);
  const total = denominations.reduce((sum, d) => sum + d.value_minor * (counts[String(d.value_minor)] ?? 0), 0);
  const change = segment.type === 'money.making-change.v2' ? segment.payload : null;
  // $2 (GAP-FIX-R2): the learner says the running count after each coin; Core checks it counts UP from the price to the amount paid.
  const [said, setSaid] = useState<number[]>([]);
  const [saying, setSaying] = useState<string | null>(null);
  const coins = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const awaiting = change !== null && said.length < coins;
  const locked = grading.pending || grading.met;
  const countUp = change ? <div className="lf-coin-count-up">
    <p data-copy-role="data">{t.countUp}: {said.length ? said.map((value) => format(value)).join(', ') : '…'}</p>
  </div> : null;
  return <BoardShell screen={change ? 'making-change' : 'coin-tray'} locale={document.locale} title={document.title} segment={segment}
    onBack={onBack} sequence={sequence} finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setCounts(empty()); setSaid([]); setSaying(null); }} resetDisabled={coins === 0 || locked}
    foot={<GradedFoot locale={document.locale} grading={grading} named={change ? namedFeedback(document.locale, 'making-change', { price: format(change.price_minor), paid: format(change.paid_minor) }) : namedFeedback(document.locale, 'coin-tray', { total: format(total) })} feedback={segment.feedback} canCheck={total > 0 && !awaiting} sequence={sequence}
      onCheck={() => grading.check(change ? { counts, sequence: said } : { counts })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-tray`}>
      <h2 id={`${segment.id}-tray`} data-copy-role="heading">{t.tray}</h2>
      {change ? <dl className="lf-coin-facts">
        <div><dt data-copy-role="body">{t.price}</dt><dd data-copy-role="data">{format(change.price_minor)}</dd></div>
        <div><dt data-copy-role="body">{t.paid}</dt><dd data-copy-role="data">{format(change.paid_minor)}</dd></div>
      </dl> : null}
      <CoinGroupsVisual label={`${t.tray}. ${change ? t.change : t.total}: ${format(total)}`} aside={countUp}
        groups={denominations.map((d) => ({ id: String(d.value_minor), label: format(d.value_minor), kind: d.kind, count: counts[String(d.value_minor)] ?? 0,
          subtotal: format(d.value_minor * (counts[String(d.value_minor)] ?? 0)) }))} />
      <p className="lf-coin-total" role="status" data-copy-role="body"><strong>{change ? t.change : t.total}:</strong> {format(total)}</p>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.tray}>
      <div className="lf-coin-tray">
        {denominations.map((d) => <div key={d.value_minor} className="lf-coin">
          <Stepper label={format(d.value_minor)} valuePlacement="label" min={0} max={d.available} value={counts[String(d.value_minor)] ?? 0}
            disabled={locked || awaiting} labels={{ decrease: t.fewer, increase: t.more }}
            onValueChange={(value) => { grading.reset(); if (change && value < (counts[String(d.value_minor)] ?? 0)) { setSaid([]); setCounts(empty()); return; }
              setCounts((current) => ({ ...current, [String(d.value_minor)]: value })); }} />
        </div>)}
      </div>
      {change && awaiting ? <div className="lf-coin-count-up"><NumberAnswer label={t.sayCount} locale={document.locale} onChange={setSaying} disabled={locked} />
        <Button variant="sky" disabled={saying === null || !Number.isSafeInteger(Number(saying))}
          onClick={() => { setSaid((current) => [...current, currency === 'local' ? Math.round(Number(saying) * 100) : Number(saying)]); }}>{t.say}</Button></div> : null}
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
    foot={<GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'story')} feedback={segment.feedback} canCheck={choice !== null} sequence={sequence} onCheck={() => grading.check({ choice })} />}>
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
    <NarrationControl segmentId={segment.id} locale={document.locale} />
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
      <NarrationControl segmentId={segment.id} locale={document.locale} />
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
    foot={question ? <GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'chart-question')} feedback={segment.feedback} canCheck={choice !== null} sequence={sequence} onCheck={() => grading.check({ choice })} />
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
