import type { CSSProperties } from 'react';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { FIN2_COPY } from './copy';
import { gridFrame } from './matrix.generated';
import { SlotBoardShell, Zone, describeZones, useSlotBoard, word, wrapLines, type Cell, type Words } from './slotBoard';
import './MatrixBoard.css';

type GridSegment = Extract<HorizonteSegment, { type: 'reasoning.decision-grid.v2' }>;
type Labels = Readonly<Record<string, string>>;
type Slots = Readonly<Record<string, readonly string[]>>;

const LAYOUT: Readonly<Record<string, Readonly<Record<string, Cell>>>> = {
  swot: { strengths: [1, 1, 1, 1], weaknesses: [2, 1, 1, 1], opportunities: [1, 2, 1, 1], threats: [2, 2, 1, 1] },
  eisenhower: { 'do-now': [1, 1, 1, 1], schedule: [2, 1, 1, 1], delegate: [1, 2, 1, 1], drop: [2, 2, 1, 1] },
  'two-by-two': { 'top-left': [1, 1, 1, 1], 'top-right': [2, 1, 1, 1], 'bottom-left': [1, 2, 1, 1], 'bottom-right': [2, 2, 1, 1] },
  'business-canvas': {
    partners: [1, 1, 1, 2], activities: [2, 1, 1, 1], resources: [2, 2, 1, 1], value: [3, 1, 1, 2], relationships: [4, 1, 1, 1],
    channels: [4, 2, 1, 1], segments: [5, 1, 1, 2], costs: [1, 3, 2, 1], revenue: [3, 3, 3, 1],
  },
};
const COLUMNS: Readonly<Record<string, number>> = { swot: 2, eisenhower: 2, 'two-by-two': 2, 'business-canvas': 5 };
const ROWS: Readonly<Record<string, number>> = { swot: 2, eisenhower: 2, 'two-by-two': 2, 'business-canvas': 3 };
const NOTED = new Set(['swot', 'eisenhower']);
const WIDTH = 320;

function BoxMap({ t, visual, slots, name }: { t: Words; visual: string; slots: Slots; name: (slot: string) => string }) {
  const layout = LAYOUT[visual]!;
  const cols = COLUMNS[visual]!;
  const rows = ROWS[visual]!;
  const gap = 6;
  const cellWidth = (WIDTH - gap * (cols - 1)) / cols;
  const rowHeight = cols === 5 ? 44 : 64;
  const named = cols === 2;
  return <svg className="lf-grid-chart" viewBox={`0 0 ${WIDTH} ${rows * rowHeight + gap * (rows - 1)}`} role="img" aria-label={t.chartMap} data-copy-role="data" focusable="false">
    {Object.entries(layout).map(([slot, [column, row, across, down]]) => {
      const x = (column - 1) * (cellWidth + gap);
      const y = (row - 1) * (rowHeight + gap);
      const width = across * cellWidth + (across - 1) * gap;
      const height = down * rowHeight + (down - 1) * gap;
      const count = slots[slot]?.length ?? 0;
      const perRow = Math.max(1, Math.floor((width - 8) / 12));
      return <g key={slot}>
        <rect className={count > 0 ? 'lf-grid-box lf-grid-box--filled' : 'lf-grid-box'} x={x} y={y} width={width} height={height} rx="6" />
        {named ? wrapLines(name(slot), 20).map((line, index) => <text key={index} x={x + 8} y={y + 18 + index * 14}>{line}</text>) : null}
        {Array.from({ length: count }, (_, index) => <circle key={index} className="lf-grid-dot" r="4" cx={x + 12 + (index % perRow) * 12} cy={y + height - 10 - Math.floor(index / perRow) * 12} />)}
      </g>;
    })}
  </svg>;
}

const PLOT = { left: 52, right: 312, top: 8, bottom: 208 };

function Plot({ t, labels, pieces, points, slots }: { t: Words; labels: Labels; pieces: readonly string[]; points: ReadonlyArray<readonly number[]>; slots: Slots }) {
  const placed = new Set(Object.values(slots).flat());
  const px = (value: number) => PLOT.left + ((value - 0.5) / 9) * (PLOT.right - PLOT.left);
  const py = (value: number) => PLOT.bottom - ((value - 0.5) / 9) * (PLOT.bottom - PLOT.top);
  const middleX = px(5);
  const middleY = py(5);
  const middle = (PLOT.top + PLOT.bottom) / 2;
  return <svg className="lf-grid-chart" viewBox="0 0 320 250" role="img" aria-label={t.chartPlot} data-copy-role="data" focusable="false">
    <rect className="lf-grid-box" x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} />
    <line className="lf-grid-middle" x1={middleX} x2={middleX} y1={PLOT.top} y2={PLOT.bottom} />
    <line className="lf-grid-middle" x1={PLOT.left} x2={PLOT.right} y1={middleY} y2={middleY} />
    <text x={PLOT.left} y="226">{labels['x-low']}</text>
    <text x={PLOT.right} y="226" textAnchor="end">{labels['x-high']}</text>
    <text x={(PLOT.left + PLOT.right) / 2} y="244" textAnchor="middle">{labels['x-name']}</text>
    <text x="24" y={PLOT.top} textAnchor="end" transform={`rotate(-90 24 ${PLOT.top})`}>{labels['y-high']}</text>
    <text x="24" y={PLOT.bottom} transform={`rotate(-90 24 ${PLOT.bottom})`}>{labels['y-low']}</text>
    <text x="10" y={middle} textAnchor="middle" transform={`rotate(-90 10 ${middle})`}>{labels['y-name']}</text>
    {pieces.map((piece, index) => <g key={piece}>
      <circle className={placed.has(piece) ? 'lf-grid-point lf-grid-point--placed' : 'lf-grid-point'} cx={px(points[index]![0]!)} cy={py(points[index]![1]!)} r="10" />
      <text className="lf-grid-point-number" x={px(points[index]![0]!)} y={py(points[index]![1]!) + 4} textAnchor="middle">{index + 1}</text>
    </g>)}
  </svg>;
}

function Scores({ t, labels, pieces, criteria, scores }: { t: Words; labels: Labels; pieces: readonly string[]; criteria: ReadonlyArray<{ id: string; weight: number }>; scores: ReadonlyArray<readonly number[]> }) {
  const first = 96;
  const column = (WIDTH - first) / criteria.length;
  const headerLines = criteria.map((criterion) => wrapLines(labels[criterion.id] ?? criterion.id, Math.max(6, Math.floor(column / 6.5))));
  const header = 12 * (Math.max(...headerLines.map((lines) => lines.length)) + 1) + 6;
  const rowHeight = 32;
  return <svg className="lf-grid-chart" viewBox={`0 0 ${WIDTH} ${header + pieces.length * rowHeight}`} role="img" aria-label={t.chartScores} data-copy-role="data" focusable="false">
    {criteria.map((criterion, index) => <g key={criterion.id}>
      {headerLines[index]!.map((line, at) => <text key={at} x={first + index * column + 2} y={12 + at * 12}>{line}</text>)}
      <text className="lf-grid-weight" x={first + index * column + 2} y={12 + headerLines[index]!.length * 12}>{fillSlot(t.weight, criterion.weight)}</text>
    </g>)}
    {pieces.map((piece, row) => {
      const y = header + row * rowHeight;
      return <g key={piece}>
        {wrapLines(labels[piece] ?? piece, 14).slice(0, 2).map((line, at) => <text key={at} x="0" y={y + 14 + at * 12}>{line}</text>)}
        {criteria.map((criterion, index) => {
          const score = scores[row]![index]!;
          const room = column - 22;
          return <g key={criterion.id}>
            <rect className="lf-grid-score" x={first + index * column + 2} y={y + 6} width={(score / 5) * room} height="12" rx="3" />
            <text x={first + index * column + 6 + (score / 5) * room} y={y + 16}>{score}</text>
          </g>;
        })}
      </g>;
    })}
  </svg>;
}

function Grid({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: GridSegment }) {
  const t = copyText(FIN2_COPY, document.locale);
  const visual = segment.visual.type;
  const labels = segment.labels;
  const payload = segment.payload;
  const frame = gridFrame(visual, payload)!;
  const pieceName = (piece: string) => labels[piece] ?? piece;
  const quadrant = (slot: string) => [labels[slot.startsWith('top') ? 'y-high' : 'y-low'], labels[slot.endsWith('left') ? 'x-low' : 'x-high']].join(', ');
  const name = (slot: string) => (visual === 'two-by-two' ? quadrant(slot) : visual === 'decision-matrix' ? fillSlot(t.rank, slot.slice('rank-'.length)) : word(t, `slot:${slot}`));
  const note = (piece: string): string | null => {
    const index = payload.pieces.indexOf(piece);
    if (visual === 'two-by-two') {
      const [x, y] = payload.points![index]!;
      return `${fillSlot(t.dot, index + 1)}: ${labels['x-name']} ${x}, ${labels['y-name']} ${y}`;
    }
    if (visual === 'decision-matrix') return payload.criteria!.map((criterion, at) => `${pieceName(criterion.id)} ${payload.scores![index]![at]}`).join(', ');
    return null;
  };
  const board = useSlotBoard({ segmentId: segment.id, frame, start: {}, onGrade, label: pieceName, note, name, trayLabel: t.backToTray });

  const placeOf = (piece: string) => Object.entries(board.slots).find(([, pieces]) => pieces.includes(piece))?.[0];
  const placeName = (piece: string) => { const slot = placeOf(piece); return slot ? name(slot) : t.none; };
  const zones = frame.slotIds.map((slot) => ({ name: name(slot), pieces: board.slots[slot] ?? [] }));
  const placedCount = frame.pieceIds.length - board.tray.length;
  const weights = visual === 'decision-matrix' ? `${t.weights}: ${payload.criteria!.map((criterion) => `${pieceName(criterion.id)} ${criterion.weight}`).join(', ')}. ` : '';
  const status = `${fillSlot(fillSlot(t.placed, placedCount), frame.pieceIds.length)}. ${weights}${describeZones(zones, pieceName, t.none)}`;

  const named = visual === 'two-by-two' ? { met: t.plottedMet, hint: t.plottedHint } : visual === 'decision-matrix' ? { met: t.rankedMet, hint: t.rankedHint } : { met: t.sortedMet, hint: t.sortedHint };
  const table = visual === 'two-by-two'
    ? { caption: t.tablePlot, head: [t.colPiece, labels['x-name']!, labels['y-name']!, t.colPlace], rows: payload.pieces.map((piece, index) => [pieceName(piece), String(payload.points![index]![0]), String(payload.points![index]![1]), placeName(piece)]) }
    : visual === 'decision-matrix'
      ? { caption: t.tableScores, head: [t.colOption, ...payload.criteria!.map((criterion) => `${pieceName(criterion.id)} (${fillSlot(t.weight, criterion.weight)})`), t.colRank],
        rows: payload.pieces.map((piece, index) => [pieceName(piece), ...payload.scores![index]!.map(String), placeName(piece)]) }
      : { caption: t.tableGrid, head: [t.colPiece, t.colPlace], rows: payload.pieces.map((piece) => [pieceName(piece), placeName(piece)]) };

  const layout = LAYOUT[visual];
  return <SlotBoardShell screen="decision-grid" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={named} status={status} tray heading={t.tray} table={table}>
    {layout ? <BoxMap t={t} visual={visual} slots={board.slots} name={name} /> : null}
    {visual === 'two-by-two' ? <Plot t={t} labels={labels} pieces={payload.pieces} points={payload.points!} slots={board.slots} /> : null}
    {visual === 'decision-matrix' ? <Scores t={t} labels={labels} pieces={payload.pieces} criteria={payload.criteria!} scores={payload.scores!} /> : null}
    <div className={layout ? 'lf-slotzones lf-slotzones--grid' : 'lf-slotzones'} style={layout ? ({ '--zcols': COLUMNS[visual] } as CSSProperties) : undefined}>
      {frame.slotIds.map((slot) => <Zone key={slot} board={board} id={slot} name={name(slot)} cell={layout?.[slot]} note={NOTED.has(visual) ? word(t, `note:${slot}`) : null} />)}
    </div>
  </SlotBoardShell>;
}

export default function MatrixBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'reasoning.decision-grid.v2' ? <Grid segment={segment} {...rest} /> : null;
}
