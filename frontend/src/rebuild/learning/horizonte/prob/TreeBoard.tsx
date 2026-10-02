import { useState } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PROB_COPY } from './copy';
import { TREE_SLOTS, chipId, type Ratio, type TreeSlot } from './model.generated';
import { TableToggle, fmt, people, slots } from './shared';
import '../horizonte.css';
import './prob.css';

type TreeSegment = Extract<HorizonteSegment, { type: 'prob.tree.v2' }>;
type Placed = Partial<Record<TreeSlot, string>>;
type Words = { readonly [K in keyof typeof PROB_COPY]: string };

const VIEW_W = 640;
const VIEW_H = 340;
const ROOT = { cx: 320, y: 10, w: 160, h: 44 };
const NODES: Readonly<Record<TreeSlot, { cx: number; y: number; w: number; h: number; side: 'has' | 'lacks'; parent: TreeSlot | null }>> = {
  has: { cx: 160, y: 116, w: 200, h: 70, side: 'has', parent: null },
  lacks: { cx: 480, y: 116, w: 200, h: 70, side: 'lacks', parent: null },
  'has-pos': { cx: 80, y: 252, w: 148, h: 70, side: 'has', parent: 'has' },
  'has-neg': { cx: 240, y: 252, w: 148, h: 70, side: 'has', parent: 'has' },
  'lacks-pos': { cx: 400, y: 252, w: 148, h: 70, side: 'lacks', parent: 'lacks' },
  'lacks-neg': { cx: 560, y: 252, w: 148, h: 70, side: 'lacks', parent: 'lacks' },
};
const SLOT_NAME = { has: 'slotHas', lacks: 'slotLacks', 'has-pos': 'slotHasPos', 'has-neg': 'slotHasNeg', 'lacks-pos': 'slotLacksPos', 'lacks-neg': 'slotLacksNeg' } as const satisfies Record<TreeSlot, keyof typeof PROB_COPY>;
const isSlot = (value: string): value is TreeSlot => (TREE_SLOTS as readonly string[]).includes(value);

/** A chip sits on one branch at a time: taking it somewhere else frees its old branch, and a branch holds one chip. */
function put(current: Placed, item: string, target: string): Placed {
  const next: Placed = {};
  for (const slot of TREE_SLOTS) if (current[slot] !== undefined && current[slot] !== item) next[slot] = current[slot];
  if (isSlot(target)) next[target] = item;
  return next;
}

/*
 * H14: a tree for one whole population. The three shares are written out; the learner drags each head count onto the
 * branch it belongs to (or taps a count, then a branch, or uses the Move to menu). The answer is the arrangement; Core
 * holds the one tree these shares grow.
 */
function Tree({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TreeSegment }) {
  const locale = document.locale;
  const t: Words = copyText(PROB_COPY, locale);
  const { population, prior, hit, alarm, chips } = segment.payload;
  const [placed, setPlaced] = useState<Placed>({});
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const count = TREE_SLOTS.filter((slot) => placed[slot] !== undefined).length;

  const place = (item: string, target: string) => {
    if (locked || !chips.some((chip) => chipId(chip) === item)) return;
    grading.reset();
    setPlaced((current) => put(current, item, target));
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setPlaced({}); };

  const slotOf = (item: string): TreeSlot | undefined => TREE_SLOTS.find((slot) => placed[slot] === item);
  const label = (chip: number) => people(locale, chip, t);
  const name = (slot: TreeSlot) => t[SLOT_NAME[slot]];
  const rate = (ratio: Ratio) => slots(t.rateOf, { part: fmt(locale, ratio.part, 0), whole: fmt(locale, ratio.whole, 0) });
  const share: Readonly<Record<TreeSlot, string>> = { has: rate(prior), lacks: t.theRest, 'has-pos': rate(hit), 'has-neg': t.theRest, 'lacks-pos': rate(alarm), 'lacks-neg': t.theRest };
  const value = (slot: TreeSlot): string | null => (placed[slot] === undefined ? null : fmt(locale, Number(placed[slot]!.slice(2)), 0));
  const fact = (text: string, ratio: Ratio) => slots(text, { part: fmt(locale, ratio.part, 0), whole: fmt(locale, ratio.whole, 0) });

  const carriedSlot = drag.carried === null ? undefined : slotOf(drag.carried);
  const carriedLabel = drag.carried === null ? null : { label: label(Number(drag.carried.slice(2))) };
  const targets = drag.carried === null ? [] : [
    ...TREE_SLOTS.filter((slot) => slot !== carriedSlot).map((slot) => ({ value: slot as string, label: name(slot) })),
    ...(carriedSlot === undefined ? [] : [{ value: 'tray', label: t.moveBack }]),
  ];
  const tray = [...chips].sort((a, b) => a - b);

  return <BoardShell screen="prob-tree" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={count === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metTree, hint: t.hintTree }}
      onCheck={() => grading.check({ slots: Object.fromEntries(TREE_SLOTS.filter((slot) => placed[slot] !== undefined).map((slot) => [slot, [placed[slot]]])) })} />}>
    <section className="lf-learning-board lf-prob" aria-label={t.treeName}>
      <ul className="lf-prob-facts">
        <li data-copy-role="body">{fact(t.factPrior, prior)}</li>
        <li data-copy-role="body">{fact(t.factHit, hit)}</li>
        <li data-copy-role="body">{fact(t.factAlarm, alarm)}</li>
      </ul>
      <svg className="lf-prob-chart" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={t.treeName} focusable="false" data-copy-role="data">
        {TREE_SLOTS.map((slot) => {
          const node = NODES[slot];
          const parent = node.parent === null ? { cx: ROOT.cx, bottom: ROOT.y + ROOT.h } : { cx: NODES[node.parent].cx, bottom: NODES[node.parent].y + NODES[node.parent].h };
          return <g key={slot}>
            <line className="lf-prob-edge" x1={parent.cx} y1={parent.bottom} x2={node.cx} y2={node.y} />
            <text className="lf-prob-edge-label" x={(parent.cx + node.cx) / 2} y={(parent.bottom + node.y) / 2 + 6} textAnchor="middle">{share[slot]}</text>
          </g>;
        })}
        <rect className="lf-prob-root" x={ROOT.cx - ROOT.w / 2} y={ROOT.y} width={ROOT.w} height={ROOT.h} rx={10} />
        <text className="lf-prob-root-label" x={ROOT.cx} y={ROOT.y + 30} textAnchor="middle">{people(locale, population, t)}</text>
        {TREE_SLOTS.map((slot) => {
          const node = NODES[slot];
          const shown = value(slot);
          const caption = node.parent === null ? name(slot) : slot.endsWith('pos') ? t.resultPos : t.resultNeg;
          return <g key={slot}>
            <rect className={`lf-prob-slot lf-prob-slot--${node.side}${shown === null ? '' : ' lf-prob-slot--filled'}`} x={node.cx - node.w / 2} y={node.y} width={node.w} height={node.h} rx={10} {...drag.target(slot)} />
            <text className="lf-prob-node-label" x={node.cx} y={node.y + 24} textAnchor="middle">{caption}</text>
            <text className={shown === null ? 'lf-prob-node-value lf-prob-node-value--empty' : 'lf-prob-node-value'} x={node.cx} y={node.y + 56} textAnchor="middle">{shown ?? '?'}</text>
          </g>;
        })}
      </svg>
      <p className="lf-prob-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{slots(t.placedCount, { n: count })}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionTree}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colBranch}</th><th scope="col" data-copy-role="data">{t.colShare}</th><th scope="col" data-copy-role="data">{t.colCount}</th></tr></thead>
        <tbody>{TREE_SLOTS.map((slot) => <tr key={slot}>
          <th scope="row" data-copy-role="data">{name(slot)}</th><td data-copy-role="data">{share[slot]}</td><td data-copy-role="data">{value(slot) ?? t.emptyCell}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.trayHeading}>
      <h2 data-copy-role="heading">{t.trayHeading}</h2>
      <div className="lf-prob-tray" {...drag.target('tray')}>
        {tray.map((chip) => {
          const id = chipId(chip);
          const where = slotOf(id);
          return <span key={chip} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64" onClick={(event) => event.stopPropagation()}>
            <ChoiceChip {...drag.chip(id)} disabled={locked}>{where === undefined ? label(chip) : slots(t.chipPlaced, { n: label(chip), slot: name(where) })}</ChoiceChip>
          </span>;
        })}
      </div>
      <MoveToChoice locale={locale} item={carriedLabel} options={targets} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function TreeBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'prob.tree.v2' ? <Tree segment={segment} {...rest} /> : null;
}
