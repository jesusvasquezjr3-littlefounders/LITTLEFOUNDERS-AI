import { useState } from 'react';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { Prose } from '../Prose';
import { copyText } from '../copyText';
import { Plano } from '../plano/Plano';
import type { PlanoHandleLayer, PlanoPointLayer, PlanoPolylineLayer } from '../plano/model';
import { DataTable, GeomFrame, clampTo, fill, pair, type Cell, type Copy } from './boardKit';
import { GEOM2_COPY } from './copy';
import { distinct } from './geometry.generated';
import type { TransformMove } from './transformModel.generated';

type TransformSegment = Extract<HorizonteSegment, { type: 'math.transform.v2' }>;

const NAMES = 'ABCDEF';
const signed = (value: number, shown: string) => (value === 0 ? '' : `${shown}${value > 0 ? ' + ' : ' - '}${Math.abs(value)}`);

function lineText(move: Extract<TransformMove, { kind: 'reflect' }>): string {
  const { across, at } = move;
  if (across === 'vertical') return `x = ${at}`;
  if (across === 'horizontal') return `y = ${at}`;
  if (across === 'diagonal') return `y = ${at === 0 ? 'x' : signed(at, 'x')}`;
  return `y = ${at === 0 ? '-x' : signed(at, '-x')}`;
}

function ruleText(move: TransformMove, t: Copy): string {
  switch (move.kind) {
    case 'translate': return fill(t.ruleTranslate, { dx: move.dx, dy: move.dy });
    case 'reflect': return fill(t.ruleReflect, { line: lineText(move) });
    case 'rotate': return fill(t.ruleRotate, { degrees: move.degrees, about: pair(move.about) });
    case 'dilate': return fill(t.ruleDilate, { factor: move.den === 1 ? move.num : `${move.num}/${move.den}`, about: pair(move.about) });
  }
}

/** The mirror line as two far-apart points; the plane clips it. */
function mirrorPoints(move: Extract<TransformMove, { kind: 'reflect' }>, reach: number): Cell[] {
  const { across, at } = move;
  if (across === 'vertical') return [{ x: at, y: -reach }, { x: at, y: reach }];
  if (across === 'horizontal') return [{ x: -reach, y: at }, { x: reach, y: at }];
  if (across === 'diagonal') return [{ x: -reach, y: -reach + at }, { x: reach, y: reach + at }];
  return [{ x: -reach, y: reach + at }, { x: reach, y: -reach + at }];
}

/* F2.8 transformations: the figure and the move are given; the learner places each corner of the image. */
function Transform({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TransformSegment }) {
  const { extent, figure, move } = segment.payload;
  const t = copyText(GEOM2_COPY, document.locale);
  const [image, setImage] = useState<Cell[]>(figure);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const reach = extent + 1;
  const name = (index: number) => NAMES[index] ?? String(index + 1);
  const moved = image.some((point, index) => point.x !== figure[index]!.x || point.y !== figure[index]!.y);
  const apart = distinct(image);

  const place = (id: string, point: Cell) => {
    const index = Number(id.slice(1));
    grading.reset();
    setImage((now) => now.map((current, at) => (at === index ? { x: clampTo(Math.round(point.x), -extent, extent), y: clampTo(Math.round(point.y), -extent, extent) } : current)));
  };
  const reset = () => { grading.reset(); setImage(figure); };

  const handles: PlanoHandleLayer[] = image.map((point, index) => ({
    id: `v${index}`, x: point.x, y: point.y, label: fill(t.tfImageOf, { name: name(index) }), caption: `${name(index)}'`, series: 2, disabled: locked,
    bounds: { xMin: -extent, xMax: extent, yMin: -extent, yMax: extent },
  }));
  const points: PlanoPointLayer[] = figure.map((point, index) => ({ id: `pre-${index}`, x: point.x, y: point.y, label: name(index), series: 1 }));
  if (move.kind === 'rotate' || move.kind === 'dilate') points.push({ id: 'center', x: move.about.x, y: move.about.y, label: t.tfCenter, series: 3 });
  const polylines: PlanoPolylineLayer[] = [
    { id: 'figure', points: [...figure, figure[0]!], label: t.tfFigure, series: 1 },
    { id: 'image', points: [...image, image[0]!], series: 2 },
  ];
  if (move.kind === 'reflect') polylines.push({ id: 'mirror', points: mirrorPoints(move, reach + Math.abs(move.at)), label: t.tfMirror, series: 3 });
  const list = image.map((point, index) => `${name(index)}' ${pair(point)}`).join('; ');
  const status = <>{fill(t.tfFacts, { rule: ruleText(move, t), list })}{apart ? null : <> <Prose>{t.tfCoincide}</Prose></>}</>;

  return <GeomFrame screen="transform" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={moved && apart} answer={{ points: image }} named={{ met: t.metTransform, hint: t.hintTransform }} changed={moved}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.tfLabel} status={status}
    board={<Plano label={t.tfLabel} domain={{ xMin: -reach, xMax: reach, yMin: -reach, yMax: reach }} size={{ width: 420, height: 420 }}
      snap={1} tickStep={extent > 6 ? 2 : 1} xLabel={t.colX} yLabel={t.colY} placeOnTap tableToggle={false}
      layers={{
        points,
        polylines,
        regions: apart ? [{ id: 'image-area', points: image, label: t.tfImage, series: 2 }] : [],
        handles,
      }}
      onHandleChange={place} />}
    tableNode={<DataTable caption={t.tfCaption} head={[t.colCorner, t.colFigure, t.colImage]}
      rows={figure.map((point, index) => [fill(t.tfCorner, { name: name(index) }), pair(point), pair(image[index]!)])} />} />;
}

export default function TransformBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.transform.v2') return null;
  return <Transform segment={segment} {...rest} />;
}
