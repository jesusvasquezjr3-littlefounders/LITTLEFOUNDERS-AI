import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import type { Locale } from '../../../design/copyBudget';
import { FIN2_COPY } from './copy';
import { GOAL_MET, GOAL_SHORT, STATEMENT_GOAL_SLOT, STATEMENT_LINES, statementAccepts, statementFrame, statementHoldings, statementTotals } from './statement.generated';
import { SlotBoardShell, Zone, money, useSlotBoard, word, type Words } from './slotBoard';
import './StatementBoard.css';

type StatementSegment = Extract<HorizonteSegment, { type: 'money.cash-flow.v2' }>;

const WIDTH = 320;
const ROW = 30;
const FLOWS = ['earned', 'passive', 'expenses'] as const;
const HOLDINGS = ['assets', 'liabilities'] as const;

function Chart({ t, locale, totals, holdings }: { t: Words; locale: Locale; totals: Record<(typeof FLOWS)[number], number>; holdings: Record<(typeof HOLDINGS)[number], number> }) {
  const flowMax = Math.max(1, ...FLOWS.map((line) => totals[line]));
  const holdMax = Math.max(1, ...HOLDINGS.map((line) => holdings[line]));
  const wide = (value: number, max: number) => (value <= 0 ? 0 : Math.max(2, (value / max) * WIDTH));
  const goalX = (totals.expenses / flowMax) * WIDTH;
  const row = (line: (typeof FLOWS)[number] | (typeof HOLDINGS)[number], index: number, value: number, max: number, shown: string) => {
    const y = index * ROW + (index >= FLOWS.length ? 12 : 0);
    return <g key={line}>
      <text x="0" y={y + 12}>{word(t, `slot:${line}`)}</text>
      <text x={WIDTH} y={y + 12} textAnchor="end">{shown}</text>
      <rect className="lf-stmt-track" x="0" y={y + 17} width={WIDTH} height="8" rx="4" />
      <rect className={`lf-stmt-bar lf-stmt-bar--${line}`} x="0" y={y + 17} width={wide(value, max)} height="8" rx="4" />
    </g>;
  };
  return <svg className="lf-stmt-chart" viewBox={`0 0 ${WIDTH} ${ROW * 5 + 12}`} role="img" aria-label={t.chartStatement} data-copy-role="data" focusable="false">
    {FLOWS.map((line, index) => row(line, index, totals[line], flowMax, fillSlot(t.perMonth, money(locale, totals[line]))))}
    {HOLDINGS.map((line, index) => row(line, FLOWS.length + index, holdings[line], holdMax, money(locale, holdings[line])))}
    {totals.expenses > 0 ? <line className="lf-stmt-goal" x1={goalX} x2={goalX} y1={ROW + 12} y2={ROW * 3 + 12} /> : null}
  </svg>;
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
    <div className="lf-slotzones lf-slotzones--statement">
      {frame.slotIds.map((slot) => <Zone key={slot} board={board} id={slot} name={name(slot)} note={slot === STATEMENT_GOAL_SLOT ? null : subtotal(slot as (typeof STATEMENT_LINES)[number])} />)}
    </div>
  </SlotBoardShell>;
}

export default function StatementBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'money.cash-flow.v2' ? <Statement segment={segment} {...rest} /> : null;
}
