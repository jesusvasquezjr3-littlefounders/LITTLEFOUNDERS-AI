import { useCallback, useMemo, useState, type ReactElement } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ChoiceChip, RadioGroup, SegmentedControl } from '../design/controls';
import { buildCopy, type BuildCopy } from './buildCopy';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { RatioLinesVisual } from './pizarron';
import { BoardShell, GradedFoot, NumberAnswer, useSegmentGrade, type OnGradeSegment } from './segmentKit';
import type { FlowTree, RuleExpr } from './v2SegmentFamilies.generated';
import './familyBoards.css';

/*
 * GAP-FIX-R2 learning: the boards that build and test (Appendix P $6, L2,
 * L6/$9). Each sends only ids and canonical numbers; Core grades the unit
 * prices and choice, the compiled rule and the built chart against its
 * private rubric (hidden scenarios for the rule and the chart), never the
 * layout. Every action is a tap or keyboard control (no drag-only paths).
 */

type Seg<T extends LessonClientSegment['type']> = Extract<LessonClientSegment, { type: T }>;
interface BoardProps<T extends LessonClientSegment['type']> {
  document: LessonClientDocument; segment: Seg<T>; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}
const verdictOf = (grading: ReturnType<typeof useSegmentGrade>) => grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null;
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

/* ── $6: unit price per offer, then the better choice ("Always show the unit"). ── */

function OfferPrice({ label, locale, disabled, onPrice }: { label: string; locale: Locale; disabled: boolean; onPrice: (value: string | null) => void }) {
  return <NumberAnswer label={label} locale={locale} disabled={disabled} onChange={onPrice} />;
}

export function UnitPriceBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.unit-price.v2'>) {
  const t = buildCopy[document.locale];
  const { offers, unit, currency } = segment.payload;
  const grading = useSegmentGrade(segment.id, onGrade);
  const [prices, setPrices] = useState<Record<string, string | null>>({});
  const [choice, setChoice] = useState<string | null>(null);
  const format = useMemo(() => {
    const money = new Intl.NumberFormat(document.locale, { style: 'currency', currency: localCurrency[document.locale], maximumFractionDigits: 2 });
    const plain = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 2 });
    return (major: number) => currency === 'local' ? money.format(major) : `${plain.format(major)} ${t.coins}`;
  }, [document.locale, currency, t.coins]);
  const scale = currency === 'local' ? 100 : 1;
  const setters = useMemo(() => Object.fromEntries(offers.map((offer) => [offer.id, (value: string | null) => {
    setPrices((current) => current[offer.id] === value ? current : { ...current, [offer.id]: value });
  }])), [offers]);
  const onPrice = useCallback((id: string) => setters[id]!, [setters]);
  const complete = offers.every((offer) => typeof prices[offer.id] === 'string') && choice !== null;
  const locked = grading.pending || grading.met;
  const perUnit = `${t.per} ${unit}`;
  return <BoardShell screen="unit-price" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={verdictOf(grading)}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete} sequence={sequence}
      onCheck={() => grading.check({ unit_prices: Object.fromEntries(offers.map((offer) => [offer.id, prices[offer.id]])), choice })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-offers`}>
      <h2 id={`${segment.id}-offers`} data-copy-role="heading">{t.offers}</h2>
      {/* The shared Pizarrón ratio lines, one group per offer: 1 unit and its price above the quantity and the offer price. */}
      <RatioLinesVisual label={offers.map((offer) => `${offer.label}: ${offer.quantity} ${t.items}, ${format(offer.price_minor / scale)}. ${perUnit}: ${prices[offer.id] ? format(Number(prices[offer.id])) : '?'}`).join('. ')}
        groups={offers.map((offer) => ({ id: offer.id, title: offer.label, marked: choice === offer.id, lines: [
          { id: 'items', label: t.items, ticks: [{ id: 'one', text: '1' }, { id: 'all', text: String(offer.quantity) }] },
          { id: 'price', label: t.price, ticks: [{ id: 'one', text: prices[offer.id] ? format(Number(prices[offer.id])) : '?' }, { id: 'all', text: format(offer.price_minor / scale) }] },
        ], unit: { label: perUnit, value: prices[offer.id] ? format(Number(prices[offer.id])) : '?' } }))} />
    </section>
    <section className="lf-learning-control-strip" aria-label={perUnit}>
      {offers.map((offer) => <OfferPrice key={offer.id} label={`${offer.label}: ${perUnit}`} locale={document.locale} disabled={locked} onPrice={onPrice(offer.id)} />)}
      <RadioGroup legend={t.better} name={`${segment.id}-better`} disabled={locked} value={choice}
        options={offers.map((offer) => ({ value: offer.id, label: offer.label }))} onValueChange={(value) => { grading.reset(); setChoice(value); }} />
    </section>
  </BoardShell>;
}

/* ── L2: IF-THEN-ELSE from condition and action tiles, run on practice cards. ── */

type Op = 'none' | 'and' | 'or';
interface Literal { cond: string | null; not: boolean }
const lit = (value: Literal): RuleExpr | null => value.cond === null ? null : value.not ? { not: { c: value.cond } } : { c: value.cond };
/** Left-grouped: ((A op1 B) op2 C), each literal optionally negated at the nested level. */
export function composeRule(literals: readonly Literal[], ops: readonly Op[]): RuleExpr | null {
  let expr = lit(literals[0]!);
  if (!expr) return null;
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index]!;
    if (op === 'none') break;
    const next = lit(literals[index + 1]!);
    if (!next) return null;
    expr = op === 'and' ? { and: [expr, next] } : { or: [expr, next] };
  }
  return expr;
}
export function runRule(expr: RuleExpr, facts: Record<string, boolean>): boolean {
  if ('c' in expr) return facts[expr.c] === true;
  if ('not' in expr) return !runRule(expr.not, facts);
  if ('and' in expr) return runRule(expr.and[0], facts) && runRule(expr.and[1], facts);
  return runRule(expr.or[0], facts) || runRule(expr.or[1], facts);
}
function ruleText(expr: RuleExpr, label: (id: string) => string, t: BuildCopy): string {
  if ('c' in expr) return label(expr.c);
  if ('not' in expr) return `${t.not} ${ruleText(expr.not, label, t)}`;
  const [a, b] = 'and' in expr ? expr.and : expr.or;
  const inner = (value: RuleExpr) => 'and' in value || 'or' in value ? `(${ruleText(value, label, t)})` : ruleText(value, label, t);
  return `${inner(a)} ${'and' in expr ? t.and : t.or} ${inner(b)}`;
}

export function RuleBuilderBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.rule-builder.v2'>) {
  const t = buildCopy[document.locale];
  const { level, conditions, actions, practice } = segment.payload;
  const slots = level === 'single' ? 1 : level === 'connective' ? 2 : 3;
  const grading = useSegmentGrade(segment.id, onGrade);
  const [literals, setLiterals] = useState<Literal[]>(() => Array.from({ length: slots }, () => ({ cond: null, not: false })));
  const [ops, setOps] = useState<Op[]>(() => Array.from({ length: slots - 1 }, () => 'none' as Op));
  const [then, setThen] = useState<string | null>(null);
  const [otherwise, setOtherwise] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const expr = composeRule(literals, ops);
  const label = (id: string) => conditions.find((item) => item.id === id)?.label ?? id;
  const actionLabel = (id: string | null) => actions.find((item) => item.id === id)?.label ?? '?';
  const complete = expr !== null && then !== null && otherwise !== null;
  const locked = grading.pending || grading.met;
  const touch = () => { grading.reset(); setRan(false); };
  // A link appears once the literal before it is in play; its literal appears once the link is AND or OR.
  const shown = (index: number) => index === 0 || ops.slice(0, index - 1).every((op) => op !== 'none');
  const ruleLine = `${t.ifWord} ${expr ? ruleText(expr, label, t) : '?'} ${t.thenWord} ${actionLabel(then)} ${t.elseWord} ${actionLabel(otherwise)}`;
  return <BoardShell screen="rule-builder" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={verdictOf(grading)}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete} sequence={sequence}
      onCheck={() => grading.check({ rule: { if: expr, then, else: otherwise } })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-rule`}>
      <h2 id={`${segment.id}-rule`} data-copy-role="heading">{t.rule}</h2>
      <p className="lf-family-rule lf-rule-line" data-copy-role="data" aria-live="polite">{ruleLine}</p>
      <h3 data-copy-role="heading">{t.cards}</h3>
      <ul className="lf-rule-practice">
        {practice.map((card) => <li key={card.id} className="lf-rule-card">
          <strong data-copy-role="option">{card.label}</strong>
          <span data-copy-role="data">{conditions.map((item) => `${item.label}: ${card.facts[item.id] ? t.yes : t.no}`).join(' · ')}</span>
          <span data-copy-role="data">{t.outcome}: {ran && complete ? actionLabel(runRule(expr!, card.facts) ? then : otherwise) : t.notRun}</span>
        </li>)}
      </ul>
      <Button variant="sky" disabled={!complete || locked} onClick={() => setRan(true)}>{t.run}</Button>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.rule}>
      {literals.map((value, index) => shown(index) ? <div key={index} className="lf-rule-slot">
        {index > 0 ? <SegmentedControl legend={t.link} name={`${segment.id}-op-${index}`} disabled={locked} value={ops[index - 1]!}
          options={[{ value: 'none' as const, label: t.none }, { value: 'and' as const, label: t.and }, { value: 'or' as const, label: t.or }]}
          onValueChange={(op) => { touch(); setOps((current) => current.map((item, at) => at === index - 1 ? op : at > index - 1 && op === 'none' ? 'none' : item)); }} /> : null}
        {index === 0 || ops[index - 1] !== 'none' ? <>
          <RadioGroup legend={`${t.condition} ${index + 1}`} name={`${segment.id}-cond-${index}`} disabled={locked} value={value.cond}
            options={conditions.map((item) => ({ value: item.id, label: item.label }))}
            onValueChange={(cond) => { touch(); setLiterals((current) => current.map((item, at) => at === index ? { ...item, cond } : item)); }} />
          {level === 'nested' ? <ChoiceChip selected={value.not} disabled={locked}
            onToggle={() => { touch(); setLiterals((current) => current.map((item, at) => at === index ? { ...item, not: !item.not } : item)); }}>{t.not}</ChoiceChip> : null}
        </> : null}
      </div> : null)}
      <RadioGroup legend={t.action} name={`${segment.id}-then`} disabled={locked} value={then}
        options={actions.map((item) => ({ value: item.id, label: item.label }))} onValueChange={(value) => { touch(); setThen(value); }} />
      <RadioGroup legend={t.otherwise} name={`${segment.id}-else`} disabled={locked} value={otherwise}
        options={actions.map((item) => ({ value: item.id, label: item.label }))} onValueChange={(value) => { touch(); setOtherwise(value); }} />
    </section>
  </BoardShell>;
}

/* ── L6 / $9 (13+): build the chart from question and outcome tiles, then test it. ── */

type Draft = { kind: 'empty' } | { kind: 'outcome'; id: string } | { kind: 'question'; id: string; yes: Draft; no: Draft };
const EMPTY: Draft = { kind: 'empty' };
function toTree(draft: Draft): FlowTree | null {
  if (draft.kind === 'empty') return null;
  if (draft.kind === 'outcome') return { o: draft.id };
  const yes = toTree(draft.yes); const no = toTree(draft.no);
  return yes && no ? { q: draft.id, yes, no } : null;
}
function walk(tree: FlowTree, answers: Record<string, boolean>): string {
  return 'o' in tree ? tree.o : walk(answers[tree.q] ? tree.yes : tree.no, answers);
}
function setAt(draft: Draft, path: readonly ('yes' | 'no')[], value: Draft): Draft {
  if (path.length === 0) return value;
  if (draft.kind !== 'question') return draft;
  const [head, ...rest] = path;
  return { ...draft, [head!]: setAt(draft[head!], rest, value) };
}

export function FlowchartBuildBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'logic.flowchart.v2' | 'money.spend-decision.v2'>) {
  const t = buildCopy[document.locale];
  const payload = segment.payload as Extract<Seg<'logic.flowchart.v2'>['payload'], { mode: 'build' }>;
  const { questions, outcomes, practice } = payload;
  const grading = useSegmentGrade(segment.id, onGrade);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [tested, setTested] = useState(false);
  const tree = toTree(draft);
  const locked = grading.pending || grading.met;
  const label = (id: string) => [...questions, ...outcomes].find((item) => item.id === id)?.label ?? id;
  const place = (path: readonly ('yes' | 'no')[], value: string) => {
    grading.reset(); setTested(false);
    const question = questions.some((item) => item.id === value);
    setDraft((current) => setAt(current, path, question ? { kind: 'question', id: value, yes: EMPTY, no: EMPTY } : { kind: 'outcome', id: value }));
  };
  const node = (value: Draft, path: readonly ('yes' | 'no')[], asked: readonly string[], heading: string): ReactElement => {
    const options = [...questions.filter((item) => !asked.includes(item.id)), ...outcomes].map((item) => ({ value: item.id, label: item.label }));
    return <li className={`lf-flow-node lf-flow-node--${value.kind === 'question' ? 'question' : 'outcome'}`}>
      <RadioGroup legend={`${heading}: ${t.putHere}`} name={`${segment.id}-${path.join('-') || 'root'}`} disabled={locked}
        value={value.kind === 'empty' ? null : value.id} options={options} onValueChange={(choice) => place(path, choice)} />
      {value.kind === 'question' ? <ul className="lf-flow-branches">
        {node(value.yes, [...path, 'yes'], [...asked, value.id], `${label(value.id)} ${t.yesBranch}`)}
        {node(value.no, [...path, 'no'], [...asked, value.id], `${label(value.id)} ${t.noBranch}`)}
      </ul> : null}
    </li>;
  };
  return <BoardShell screen={segment.type === 'money.spend-decision.v2' ? 'spend-decision-build' : 'flowchart-build'} locale={document.locale} title={document.title}
    segment={segment} onBack={onBack} sequence={sequence} finished={grading.met} verdict={verdictOf(grading)}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={tree !== null} sequence={sequence} onCheck={() => grading.check({ tree })} />}>
    <section className="lf-learning-board lf-family-board" aria-labelledby={`${segment.id}-chart`}>
      <h2 id={`${segment.id}-chart`} data-copy-role="heading">{t.chart}</h2>
      <ul className="lf-flow-build">{node(draft, [], [], t.start)}</ul>
      <h3 data-copy-role="heading">{t.cards}</h3>
      <ul className="lf-rule-practice">
        {practice.map((card) => <li key={card.id} className="lf-rule-card">
          <strong data-copy-role="option">{card.label}</strong>
          <span data-copy-role="data">{questions.map((item) => `${item.label} ${card.answers[item.id] ? t.yes : t.no}`).join(' · ')}</span>
          <span data-copy-role="data">{t.outcome}: {tested && tree ? label(walk(tree, card.answers)) : t.notRun}</span>
        </li>)}
      </ul>
      <Button variant="sky" disabled={tree === null || locked} onClick={() => setTested(true)}>{t.test}</Button>
    </section>
  </BoardShell>;
}
