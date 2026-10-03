import type { CSSProperties } from 'react';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import type { Locale } from '../../../design/copyBudget';
import { FIN2_COPY } from './copy';
import { GOAL_MET, GOAL_SHORT, STATEMENT_GOAL_SLOT, STATEMENT_LINES, statementAccepts, statementFrame, statementHoldings, statementTotals } from './statement.generated';
import { SlotBoardShell, Zone, money, useSlotBoard, word, type Words } from './slotBoard';
import './StatementBoard.css';

type StatementSegment = Extract<HorizonteSegment, { type: 'money.cash-flow.v2' }>;

const FLOWS = ['earned', 'passive', 'expenses'] as const;
const HOLDINGS = ['assets', 'liabilities'] as const;
type Line = (typeof FLOWS)[number] | (typeof HOLDINGS)[number];

/** Named bars on one scale; `goal` is the level the tick marks on every track of the group. */
function Bars({ t, lines, values, shown, goal }: { t: Words; lines: readonly Line[]; values: Readonly<Record<string, number>>; shown: (line: Line) => string; goal: number }) {
  const max = Math.max(1, ...lines.map((line) => values[line]!));
  return <div className="lf-stmt-group" style={goal > 0 ? ({ '--goal': `${(goal / max) * 100}%` } as CSSProperties) : undefined}>
    {lines.map((line) => <div key={line} className="lf-stmt-row">
      <span className="lf-stmt-name" data-copy-role="data">{word(t, `slot:${line}`)}</span>
      <span className="lf-stmt-amount" data-copy-role="data">{shown(line)}</span>
      <span className="lf-stmt-track" data-goal={goal > 0 ? '' : undefined}>
        {values[line]! > 0 ? <span className={`lf-stmt-bar lf-stmt-bar--${line}`} style={{ inlineSize: `${(values[line]! / max) * 100}%` }} /> : null}
      </span>
    </div>)}
  </div>;
}

function Chart({ t, locale, totals, holdings }: { t: Words; locale: Locale; totals: Record<(typeof FLOWS)[number], number>; holdings: Record<(typeof HOLDINGS)[number], number> }) {
  return <div className="lf-stmt-chart" role="img" aria-label={t.chartStatement}>
    <Bars t={t} lines={FLOWS} values={totals} goal={totals.expenses} shown={(line) => fillSlot(t.perMonth, money(locale, totals[line as (typeof FLOWS)[number]]))} />
    <Bars t={t} lines={HOLDINGS} values={holdings} goal={0} shown={(line) => money(locale, holdings[line as (typeof HOLDINGS)[number]])} />
  </div>;
}

function Statement({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: StatementSegment }) {
  const locale = document.locale;
  const t = copyText(FIN2_COPY, locale);
  const items = segment.payload.items;
  const frame = statementFrame(segment.payload)!;
  const amount = new Map(items.map((item) => [item.id, item.amount]));
  const label = (piece: string) => (piece === GOAL_MET || piece === GOAL_SHORT ? word(t, `piece:${piece}`) : `${segment.labels[piece] ?? piece}, ${money(locale, amount.get(piece) ?? 0)}`);
  const name = (slot: string) => word(t, `slot:${slot}`);
  const board = useSlotBoard({ segmentId: segment.id, frame, start: {}, accepts: statementAccepts, onGrade, label, name, trayLabel: t.backToTray });

  const totals = statementTotals(board.slots, items);
  const holdings = statementHoldings(board.slots, items);
  const subtotal = (line: (typeof STATEMENT_LINES)[number]): string => (line === 'assets' || line === 'liabilities'
    ? money(locale, holdings[line]) : fillSlot(t.perMonth, money(locale, totals[line])));
  const placedCount = frame.pieceIds.length - board.tray.length;
  const goalPiece = board.slots[STATEMENT_GOAL_SLOT]?.[0];
  const status = [
    fillSlot(fillSlot(t.placed, placedCount), frame.pieceIds.length),
    ...STATEMENT_LINES.map((line) => `${name(line)}: ${subtotal(line)}`),
    `${name(STATEMENT_GOAL_SLOT)}: ${goalPiece ? label(goalPiece) : t.none}`,
  ].join('. ') + '.';
  const lineOf = (item: string) => Object.entries(board.slots).find(([, pieces]) => pieces.includes(item))?.[0];

  return <SlotBoardShell screen="cash-flow" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.statementMet, hint: t.statementHint }} status={status} tray heading={t.tray}
    table={{
      caption: t.tableStatement, head: [t.colItem, t.colLine, t.colAmount],
      rows: [
        ...items.map((item) => [segment.labels[item.id] ?? item.id, lineOf(item.id) ? name(lineOf(item.id)!) : t.none, money(locale, item.amount)]),
        [name(STATEMENT_GOAL_SLOT), goalPiece ? label(goalPiece) : t.none, ''],
      ],
    }}>
    <Chart t={t} locale={locale} totals={totals} holdings={holdings} />
    <div className="lf-slotzones">
      {frame.slotIds.map((slot) => <Zone key={slot} board={board} id={slot} name={name(slot)} note={slot === STATEMENT_GOAL_SLOT ? null : subtotal(slot as (typeof STATEMENT_LINES)[number])} />)}
    </div>
  </SlotBoardShell>;
}

export default function StatementBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'money.cash-flow.v2' ? <Statement segment={segment} {...rest} /> : null;
}
