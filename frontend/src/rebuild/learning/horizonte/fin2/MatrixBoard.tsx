import { Fragment, type CSSProperties } from 'react';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { FIN2_COPY } from './copy';
import { gridFrame } from './matrix.generated';
import { SlotBoardShell, Zone, describeZones, useSlotBoard, word, type Cell, type Words } from './slotBoard';
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
const NOTED = new Set(['swot', 'eisenhower']);

function BoxMap({ t, visual, slots, name }: { t: Words; visual: string; slots: Slots; name: (slot: string) => string }) {
  const named = COLUMNS[visual] === 2;
  return <div className={named ? 'lf-grid-map lf-grid-map--named' : 'lf-grid-map'} role="img" aria-label={t.chartMap} style={{ '--cols': COLUMNS[visual] } as CSSProperties}>
    {Object.entries(LAYOUT[visual]!).map(([slot, [column, row, across, down]]) => {
      const count = slots[slot]?.length ?? 0;
      return <div key={slot} className={count > 0 ? 'lf-grid-box lf-grid-box--filled' : 'lf-grid-box'} style={{ '--zc': column, '--zr': row, '--zw': across, '--zh': down } as CSSProperties}>
        {named ? <span className="lf-grid-name" data-copy-role="data">{name(slot)}</span> : null}
        {count > 0 ? <span className="lf-grid-dots">{Array.from({ length: count }, (_, index) => <span key={index} className="lf-grid-dot" />)}</span> : null}
      </div>;
    })}
  </div>;
}

const PLOT = { width: 240, height: 250 };

function Plot({ t, labels, pieces, points, slots }: { t: Words; labels: Labels; pieces: readonly string[]; points: ReadonlyArray<readonly number[]>; slots: Slots }) {
  const placed = new Set(Object.values(slots).flat());
  const px = (value: number) => 1 + ((value - 0.5) / 9) * (PLOT.width - 2);
  const py = (value: number) => PLOT.height - 1 - ((value - 0.5) / 9) * (PLOT.height - 2);
  return <div className="lf-grid-plot" role="img" aria-label={t.chartPlot}>
    <span className="lf-grid-turn lf-grid-yname" data-copy-role="data">{labels['y-name']}</span>
    <span className="lf-grid-turn lf-grid-yend lf-grid-yend--high" data-copy-role="data">{labels['y-high']}</span>
    <span className="lf-grid-turn lf-grid-yend lf-grid-yend--low" data-copy-role="data">{labels['y-low']}</span>
    <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} data-copy-role="data" focusable="false">
      <rect className="lf-grid-field" x="1" y="1" width={PLOT.width - 2} height={PLOT.height - 2} />
      <line className="lf-grid-middle" x1={px(5)} x2={px(5)} y1="1" y2={PLOT.height - 1} />
      <line className="lf-grid-middle" x1="1" x2={PLOT.width - 1} y1={py(5)} y2={py(5)} />
      {pieces.map((piece, index) => <g key={piece}>
        <circle className={placed.has(piece) ? 'lf-grid-point lf-grid-point--placed' : 'lf-grid-point'} cx={px(points[index]![0]!)} cy={py(points[index]![1]!)} r="10" />
        <text className="lf-grid-point-number" x={px(points[index]![0]!)} y={py(points[index]![1]!) + 4.5} textAnchor="middle">{index + 1}</text>
      </g>)}
    </svg>
    <span className="lf-grid-xends">
      <span className="lf-grid-xend" data-copy-role="data">{labels['x-low']}</span>
      <span className="lf-grid-xend lf-grid-xend--high" data-copy-role="data">{labels['x-high']}</span>
    </span>
    <span className="lf-grid-xname" data-copy-role="data">{labels['x-name']}</span>
  </div>;
}

/** Criteria are numbered once in a legend and the columns carry the numbers, so a long criterion name never has to fit a narrow column. */
function Scores({ t, labels, pieces, criteria, scores }: { t: Words; labels: Labels; pieces: readonly string[]; criteria: ReadonlyArray<{ id: string; weight: number }>; scores: ReadonlyArray<readonly number[]> }) {
  return <div className="lf-grid-scores" role="img" aria-label={t.chartScores} style={{ '--criteria': criteria.length } as CSSProperties}>
    <div className="lf-grid-legend">
      {criteria.map((criterion, index) => <div key={criterion.id} className="lf-grid-legend-item">
        <span className="lf-grid-badge" data-copy-role="data">{index + 1}</span>
        <span className="lf-grid-legend-name" data-copy-role="data">{labels[criterion.id] ?? criterion.id}</span>
        <span className="lf-grid-weight" data-copy-role="data">{fillSlot(t.weight, criterion.weight)}</span>
      </div>)}
    </div>
    <div className="lf-grid-matrix">
      <span />
      {criteria.map((criterion, index) => <span key={criterion.id} className="lf-grid-badge" data-copy-role="data">{index + 1}</span>)}
      {pieces.map((piece, row) => <Fragment key={piece}>
        <span className="lf-grid-option" data-copy-role="data">{labels[piece] ?? piece}</span>
        {criteria.map((criterion, index) => <span key={criterion.id} className="lf-grid-cell">
          <span className="lf-grid-num" data-copy-role="data">{scores[row]![index]}</span>
          <span className="lf-grid-track"><span className="lf-grid-score" style={{ inlineSize: `${(scores[row]![index]! / 5) * 100}%` }} /></span>
        </span>)}
      </Fragment>)}
    </div>
  </div>;
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
