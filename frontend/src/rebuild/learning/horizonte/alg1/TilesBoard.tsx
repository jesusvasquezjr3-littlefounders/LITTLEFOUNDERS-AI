import { useMemo, useState } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { ALG1_COPY } from './copy';
import { Handle, Notation, slotsOf } from './shared';
import { TILE_CLASSES, TILE_KINDS, readTileCounts, tileClass, tileIsPositive, tileKind, tilePieces, type TileClass, type TileCounts, type TileKind } from './tiles.generated';
import '../horizonte.css';
import './AlgebraBoards.css';

type TilesSegment = Extract<HorizonteSegment, { type: 'math.algebra-tiles.v2' }>;
type Pairs = Readonly<Record<TileKind, number>>;

const NAME = { 'sq-pos': 'sqPos', 'sq-neg': 'sqNeg', 'bar-pos': 'barPos', 'bar-neg': 'barNeg', 'unit-pos': 'unitPos', 'unit-neg': 'unitNeg' } as const;
const PAIR = { sq: 'pairSq', bar: 'pairBar', unit: 'pairUnit' } as const;
const SIZE = { sq: [60, 60], bar: [60, 20], unit: [20, 20] } as const;
const GAP = 6;
const WIDTH = 300;
const NONE: Pairs = { sq: 0, bar: 0, unit: 0 };

function layout(list: readonly TileClass[]) {
  const tiles: Array<{ cls: TileClass; x: number; y: number; w: number; h: number }> = [];
  let x = 0; let y = 0; let rowHeight = 0;
  for (const cls of list) {
    const [w, h] = SIZE[tileKind(cls)];
    if (x > 0 && x + w > WIDTH) { x = 0; y += rowHeight + GAP; rowHeight = 0; }
    tiles.push({ cls, x, y, w, h });
    x += w + GAP; rowHeight = Math.max(rowHeight, h);
  }
  return { tiles, height: Math.max(y + rowHeight, SIZE.unit[1]) };
}

/** The tiles as shapes: the sign is drawn as a minus or a plus, so a negative tile never relies on colour alone. */
function TileSvg({ list }: { list: readonly TileClass[] }) {
  const { tiles, height } = layout(list);
  return <svg className="lf-alg-tiles" viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true" focusable="false">
    {tiles.map(({ cls, x, y, w, h }, index) => {
      const positive = tileIsPositive(cls); const cx = x + w / 2; const cy = y + h / 2; const half = Math.min(w, h) / 4;
      return <g key={index} className={`lf-alg-tile lf-alg-tile--${positive ? 'pos' : 'neg'} lf-alg-tile--${tileKind(cls)}`}>
        <rect x={x} y={y} width={w} height={h} rx={3} />
        <path d={`M${cx - half} ${cy}H${cx + half}${positive ? `M${cx} ${cy - half}V${cy + half}` : ''}`} />
      </g>;
    })}
  </svg>;
}

function Tiles({ document, segment, counts, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TilesSegment; counts: TileCounts }) {
  const t = copyText(ALG1_COPY, document.locale);
  const pieces = useMemo(() => tilePieces(counts), [counts]);
  const [pairs, setPairs] = useState<Pairs>(NONE);
  const [blocked, setBlocked] = useState(false);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const room = (kind: TileKind): number => Math.min(counts[tileClass(kind, true)], counts[tileClass(kind, false)]) - pairs[kind];
  const matCount = (cls: TileClass): number => counts[cls] - pairs[tileKind(cls)];
  const pairsSet = TILE_KINDS.reduce((sum, kind) => sum + pairs[kind], 0);
  const changed = pairsSet > 0;

  const change = (next: Pairs) => { grading.reset(); setBlocked(false); setPairs(next); };
  const pair = (kind: TileKind) => { if (room(kind) > 0) change({ ...pairs, [kind]: pairs[kind] + 1 }); else setBlocked(true); };
  const unpair = (kind: TileKind) => { if (pairs[kind] > 0) change({ ...pairs, [kind]: pairs[kind] - 1 }); };
  const place = (item: string, target: string) => {
    if (item.startsWith('mat:') && target === 'zero') pair(tileKind(item.slice(4)));
    else if (item.startsWith('zero:') && target === 'mat') unpair(item.slice(5) as TileKind);
  };
  const drag = useDragPlace<string>(place, locked);

  const matList = TILE_CLASSES.flatMap((cls) => Array.from({ length: matCount(cls) }, () => cls));
  const zeroList = TILE_KINDS.flatMap((kind) => Array.from({ length: pairs[kind] }, () => [tileClass(kind, true), tileClass(kind, false)]).flat());
  const carriedMat = drag.carried?.startsWith('mat:') ?? false;
  const carriedName = drag.carried === null ? null : { label: carriedMat ? t[NAME[drag.carried.slice(4) as TileClass]] : t[PAIR[drag.carried.slice(5) as TileKind]] };
  const options = carriedMat ? [{ value: 'zero', label: t.zoneZero }] : [{ value: 'mat', label: t.zoneMat }];
  const reset = () => { grading.reset(); drag.clear(); setBlocked(false); setPairs(NONE); };

  const answer = () => {
    const seen: Record<string, number> = {};
    const placement: Record<string, string> = {};
    for (const piece of pieces) {
      seen[piece.cls] = (seen[piece.cls] ?? 0) + 1;
      placement[piece.id] = seen[piece.cls]! <= pairs[tileKind(piece.cls)] ? 'zero' : 'mat';
    }
    return { slots: slotsOf(placement, pieces.map((piece) => piece.id)) };
  };
  const present = TILE_CLASSES.filter((cls) => counts[cls] > 0);

  return <BoardShell screen="algebra-tiles" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metTiles, hint: t.hintTiles }} onCheck={() => grading.check(answer())} />}>
    <section className="lf-learning-board lf-alg" aria-labelledby={`${segment.id}-mat`}>
      <Notation notation={segment.notation} locale={document.locale} />
      <div className="lf-alg-zones">
        <div className="lf-alg-zone" role="group" aria-labelledby={`${segment.id}-mat`} {...drag.target('mat')}>
          <h3 id={`${segment.id}-mat`} data-copy-role="heading">{t.zoneMat}</h3>
          <TileSvg list={matList} />
        </div>
        <div className="lf-alg-zone lf-alg-zone--zero" role="group" aria-labelledby={`${segment.id}-zero`} {...drag.target('zero')}>
          <h3 id={`${segment.id}-zero`} data-copy-role="heading">{t.zoneZero}</h3>
          <TileSvg list={zeroList} />
        </div>
      </div>
      <p className="lf-alg-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.onMat}: {matList.length}. {t.zeroSet}: {pairsSet}
      </p>
      <p className="lf-alg-note" role="status" data-copy-role="body">{blocked ? t.noPair : ''}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tilesCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colTile}</th><th scope="col" data-copy-role="data">{t.colMat}</th><th scope="col" data-copy-role="data">{t.colZero}</th></tr></thead>
        <tbody>{present.map((cls) => <tr key={cls}>
          <th scope="row" data-copy-role="data">{t[NAME[cls]]}</th><td data-copy-role="data">{matCount(cls)}</td><td data-copy-role="data">{pairs[tileKind(cls)]}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.tilesTray}>
      <h2 data-copy-role="heading">{t.tilesTray}</h2>
      <div className="lf-alg-chips">
        {TILE_CLASSES.filter((cls) => matCount(cls) > 0).map((cls) => <Handle key={`mat:${cls}`} chip={drag.chip(`mat:${cls}`)} disabled={locked}>{t[NAME[cls]]}: {matCount(cls)}</Handle>)}
        {TILE_KINDS.filter((kind) => pairs[kind] > 0).map((kind) => <Handle key={`zero:${kind}`} chip={drag.chip(`zero:${kind}`)} disabled={locked}>{t[PAIR[kind]]}: {pairs[kind]}</Handle>)}
      </div>
      <MoveToChoice locale={document.locale} item={carriedName} options={options} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function TilesBoard({ segment, ...rest }: HorizonteBoardProps) {
  const counts = useMemo(() => (segment.type === 'math.algebra-tiles.v2' ? readTileCounts(segment.payload.counts) : null), [segment]);
  return segment.type === 'math.algebra-tiles.v2' && counts ? <Tiles segment={segment} counts={counts} {...rest} /> : null;
}
