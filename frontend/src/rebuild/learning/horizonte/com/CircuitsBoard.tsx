import type { Locale } from '../../../design/copyBudget';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { TRAY, type Frame } from './arrange.generated';
import {
  BITS_SLOT, bitId, bitWeight, bitWeights, bitsTotal, circuitFrame, circuitOutputs, gatesAccepts, rowInputs, type BitsPayload, type GateKind, type GatesPayload,
} from './circuits.generated';
import { COM_COPY } from './copy';
import { fill, list, word, type Words } from './format';
import { SlotBoardShell, Zone, useSlotBoard, type SlotBoard } from './slotBoard';
import { SpecTable, type TableSpec } from './specTable';
import './CircuitsBoard.css';

type CircuitSegment = Extract<HorizonteSegment, { type: 'computing.bits-gates.v2' }>;
type Labels = Readonly<Record<string, string>>;
type Props = Omit<HorizonteBoardProps, 'segment'> & { segment: CircuitSegment };
interface Inner extends Props { t: Words; locale: Locale; labels: Labels }

const NOTHING: Frame = { pieceIds: [], slotIds: [], capacities: {} };
const frameOf = (segment: CircuitSegment): Frame => circuitFrame(segment.visual.type, segment.payload) ?? NOTHING;
const placed = (board: SlotBoard, slot: string): string[] => board.slots[slot] ?? [];

/* ── bits: a row of switches, each worth twice the one on its right ── */

function BitsBoard({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const bits = segment.payload as BitsPayload;
  const board = useSlotBoard({ segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade, label: (id) => String(bitWeight(id)), name: () => t.bitsOn, trayLabel: null });
  const weights = bitWeights(bits.bits);
  const on = new Set(placed(board, BITS_SLOT));
  const total = bitsTotal([...on]);
  const table: TableSpec = {
    caption: t.tableBits, head: [t.colWeight, t.colBit, t.colValue],
    rows: weights.map((weight) => [String(weight), on.has(bitId(weight)) ? '1' : '0', String(on.has(bitId(weight)) ? weight : 0)]),
  };
  return <SlotBoardShell screen="circuits-bits" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.metBits, hint: t.hintBits }} table={table} tray={false} move={false} heading={t.headingBits}
    status={fill(t.bitsStatus, { list: list(weights.filter((weight) => on.has(bitId(weight))).map(String), t.none), total, target: bits.target })}>
    <div className="lf-bits-scroll">
      <div className="lf-bits" role="group" aria-label={t.bitsRow}>
        {weights.map((weight) => {
          const id = bitId(weight);
          const lit = on.has(id);
          return <button key={id} type="button" className="lf-bit" aria-pressed={lit} disabled={board.locked} data-copy-role="data"
            aria-label={fill(t.bitName, { weight })} onClick={() => board.place(id, lit ? TRAY : BITS_SLOT)}>
            <span className="lf-bit-weight">{weight}</span>
            <span className="lf-bit-digit">{lit ? 1 : 0}</span>
          </button>;
        })}
      </div>
    </div>
    <p className="lf-bits-total" aria-hidden="true" data-copy-role="data">{fill(t.bitsTotal, { total, target: bits.target })}</p>
  </SlotBoardShell>;
}

/* ── gates: put each gate where the wiring needs it, then read the truth table ── */

const SLOT_GAP = 52;
const INPUT_GAP = 28;
const BOX = { w: 36, h: 20 };

function Circuit({ gates, labels, aria, slotName, gateName, assigned }: {
  gates: GatesPayload; labels: Labels; aria: string; slotName: (id: string) => string; gateName: (piece: string) => string; assigned: Readonly<Record<string, string>>;
}) {
  const last = gates.slots[gates.slots.length - 1]!;
  const names = gates.inputs.map((id) => labels[id] ?? id);
  const left = Math.max(...names.map((name) => name.length)) * 3.6 + 14;
  const top = 14;
  const point = new Map<string, { x: number; y: number }>(gates.inputs.map((id, index) => [id, { x: 0, y: top + index * INPUT_GAP }]));
  gates.slots.forEach((slot, index) => {
    const ys = slot.from.map((source) => point.get(source)!.y);
    point.set(slot.id, { x: 52 + index * SLOT_GAP, y: ys.reduce((sum, y) => sum + y, 0) / ys.length });
  });
  const out = point.get(last.id)!;
  const lamp = { x: out.x + BOX.w / 2 + 26, y: out.y };
  const lampName = labels[last.id] ?? slotName(last.id);
  const width = left + lamp.x + 12 + lampName.length * 3.6 + 10;
  const height = Math.max(64, top * 2 + (gates.inputs.length - 1) * INPUT_GAP);
  const edgeOf = (source: string) => (gates.inputs.includes(source) ? 4 : BOX.w / 2);
  return <svg className="lf-circuit" viewBox={`${-left} 0 ${width} ${height}`} role="img" aria-label={aria} data-copy-role="data" focusable="false">
    {gates.slots.map((slot) => slot.from.map((source, index) => {
      const from = point.get(source)!;
      const to = point.get(slot.id)!;
      const spread = slot.from.length === 2 ? (index === 0 ? -5 : 5) : 0;
      return <path key={`${slot.id}:${source}`} className="lf-circuit-wire" fill="none"
        d={`M${from.x + edgeOf(source)} ${from.y} C${(from.x + to.x) / 2 + 8} ${from.y} ${(from.x + to.x) / 2 - 8} ${to.y + spread} ${to.x - BOX.w / 2} ${to.y + spread}`} />;
    }))}
    <path className="lf-circuit-wire" fill="none" d={`M${out.x + BOX.w / 2} ${out.y} L${lamp.x - 5} ${lamp.y}`} />
    {gates.inputs.map((id, index) => {
      const at = point.get(id)!;
      return <g key={id}>
        <circle className="lf-circuit-pin" cx={at.x} cy={at.y} r="4" />
        <text className="lf-circuit-name" x={at.x - 8} y={at.y} textAnchor="end" dominantBaseline="central">{names[index]}</text>
      </g>;
    })}
    {gates.slots.map((slot) => {
      const at = point.get(slot.id)!;
      const piece = assigned[slot.id];
      return <g key={slot.id}>
        <rect className={piece ? 'lf-circuit-box lf-circuit-box--set' : 'lf-circuit-box'} x={at.x - BOX.w / 2} y={at.y - BOX.h / 2} width={BOX.w} height={BOX.h} rx="4" />
        <text className="lf-circuit-gate" x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central">{piece ? gateName(piece) : '?'}</text>
      </g>;
    })}
    <circle className="lf-circuit-lamp" cx={lamp.x} cy={lamp.y} r="5" />
    <text className="lf-circuit-name" x={lamp.x + 9} y={lamp.y} dominantBaseline="central">{lampName}</text>
  </svg>;
}

function GatesBoard({ document, segment, onBack, sequence, onGrade, t, labels }: Inner) {
  const gates = segment.payload as GatesPayload;
  const last = gates.slots[gates.slots.length - 1]!;
  const kindOf = (piece: string): GateKind => gates.pieces.find((candidate) => candidate.id === piece)!.kind;
  const gateName = (piece: string) => {
    const kind = kindOf(piece);
    const same = gates.pieces.filter((candidate) => candidate.kind === kind);
    return `${word(t, `gate:${kind}`)}${same.length > 1 ? ` ${same.findIndex((candidate) => candidate.id === piece) + 1}` : ''}`;
  };
  const slotName = (id: string) => fill(t.positionN, { n: gates.slots.findIndex((slot) => slot.id === id) + 1 });
  const source = (id: string) => (gates.inputs.includes(id) ? labels[id] ?? id : slotName(id));
  const reads = (slot: GatesPayload['slots'][number]) => fill(slot.from.length === 2 ? t.readsTwo : t.readsOne, { a: source(slot.from[0]!), b: source(slot.from[1] ?? slot.from[0]!) });
  const board = useSlotBoard({
    segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade, accepts: gatesAccepts(gates),
    label: gateName, note: (piece) => word(t, `gateNote:${kindOf(piece)}`), name: slotName, trayLabel: t.backToTray,
  });
  const assigned = Object.fromEntries(gates.slots.flatMap((slot) => (placed(board, slot.id)[0] ? [[slot.id, placed(board, slot.id)[0]!]] : [])));
  const outputs = circuitOutputs(gates, board.slots);
  const right = outputs.filter((out, row) => out === gates.expected[row]).length;
  const truth: TableSpec = {
    caption: t.tableTruth, head: [...gates.inputs.map(source), t.colGoal, t.colNow, t.colMatch],
    rows: gates.expected.map((goal, row) => [...rowInputs(gates.inputs.length, row).map(String), String(goal), outputs[row] === null ? t.none : String(outputs[row]),
      outputs[row] === goal ? t.yes : t.no]),
  };
  const wiring: TableSpec = {
    caption: t.tableWiring, head: [t.colPosition, t.colReads, t.colGate],
    rows: gates.slots.map((slot) => [slotName(slot.id), reads(slot), assigned[slot.id] ? gateName(assigned[slot.id]!) : t.none]),
  };
  return <SlotBoardShell screen="circuits-gates" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.metGates, hint: t.hintGates }} table={wiring} tray heading={t.headingGates}
    status={fill(t.gateStatus, { placed: Object.keys(assigned).length, slots: gates.slots.length, right, total: gates.expected.length })}>
    <Circuit gates={gates} labels={labels} aria={fill(t.chartGates, { inputs: gates.inputs.length, gates: gates.slots.length })} slotName={slotName} gateName={gateName} assigned={assigned} />
    <div className="lf-slotzones">
      {gates.slots.map((slot) => <Zone key={slot.id} board={board} id={slot.id} name={slotName(slot.id)}
        note={slot.id === last.id ? `${reads(slot)} ${fill(t.outputIs, { name: labels[last.id] ?? slotName(last.id) })}` : reads(slot)} />)}
    </div>
    <SpecTable table={truth} />
  </SlotBoardShell>;
}

function Circuits(props: Props) {
  const { segment, document } = props;
  const t = copyText(COM_COPY, document.locale);
  const inner: Inner = { ...props, t, locale: document.locale, labels: segment.labels ?? {} };
  return segment.visual.type === 'bits' ? <BitsBoard {...inner} /> : <GatesBoard {...inner} />;
}

export default function CircuitsBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'computing.bits-gates.v2' ? <Circuits segment={segment} {...rest} /> : null;
}
