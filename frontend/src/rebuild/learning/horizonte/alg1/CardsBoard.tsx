import { useMemo, useState } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { cardPieces, faceValue, oppositeFace, readCards, type CardsPayload, type Disguise } from './cards.generated';
import { ALG1_COPY } from './copy';
import { Handle, Notation, slotsOf, type Placement } from './shared';
import '../horizonte.css';
import './AlgebraBoards.css';

type CardsSegment = Extract<HorizonteSegment, { type: 'math.algebra-cards.v2' }>;
type Words = { readonly [K in keyof typeof ALG1_COPY]: string };

const symbol = (face: string): string => {
  const value = faceValue(face)!;
  if (value.unknown !== 0) return value.unknown > 0 ? 'x' : '−x';
  return `${value.constant > 0 ? '+' : '−'}${Math.abs(value.constant)}`;
};

/** The words for a card: the picture disguise names it, the other two write it. */
function caption(face: string, disguise: Disguise, t: Words): string {
  if (disguise !== 'picture') return symbol(face);
  const value = faceValue(face)!;
  if (value.unknown !== 0) return value.unknown > 0 ? t.boxName : t.boxDebt;
  return fillSlot(value.constant > 0 ? t.coins : t.debt, Math.abs(value.constant));
}

/** A box for the unknown and coins for a number; a minus is a dashed outline and a drawn minus, never colour alone. */
function CardArt({ face }: { face: string }) {
  const value = faceValue(face)!;
  const negative = value.unknown < 0 || value.constant < 0;
  return <svg className={`lf-alg-art lf-alg-art--${negative ? 'neg' : 'pos'}`} viewBox="0 0 40 32" aria-hidden="true" focusable="false">
    {value.unknown !== 0
      ? <><rect x="6" y="12" width="28" height="18" rx="2" /><rect x="4" y="5" width="32" height="7" rx="2" />{negative ? <path d="M14 21H26" /> : null}</>
      : Array.from({ length: Math.abs(value.constant) }, (_, index) => <circle key={index} cx={6 + (index % 5) * 7} cy={9 + Math.floor(index / 5) * 12} r="3" />)}
  </svg>;
}

function Face({ face, disguise, t }: { face: string; disguise: Disguise; t: Words }) {
  return <>{disguise === 'notation' ? null : <CardArt face={face} />}<span className="lf-alg-caption">{caption(face, disguise, t)}</span></>;
}

function Cards({ document, segment, cards, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: CardsSegment; cards: CardsPayload }) {
  const t = copyText(ALG1_COPY, document.locale);
  const disguise = cards.disguise;
  const pieces = useMemo(() => cardPieces(cards), [cards]);
  const faces = useMemo(() => new Map(pieces.map((piece) => [piece.id, piece.cls])), [pieces]);
  const home = useMemo<Placement>(() => Object.fromEntries(pieces.map((piece) => [piece.id, piece.home])), [pieces]);
  const [placement, setPlacement] = useState<Placement>(home);
  const [history, setHistory] = useState<Placement[]>([]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const inSlot = (slot: string) => pieces.filter((piece) => placement[piece.id] === slot);
  const wordsOf = (slot: string): string => inSlot(slot).map((piece) => caption(piece.cls, disguise, t)).join(disguise === 'picture' ? ', ' : ' ') || t.empty;

  const commit = (next: Placement) => { grading.reset(); setHistory((past) => [...past, placement]); setPlacement(next); };
  const undo = () => { const last = history[history.length - 1]; if (!last) return; grading.reset(); drag.clear(); setHistory(history.slice(0, -1)); setPlacement(last); };
  const reset = () => { grading.reset(); drag.clear(); setHistory([]); setPlacement(home); };
  const mate = (id: string): string => `${id.slice(0, -1)}${id.endsWith('a') ? 'b' : 'a'}`;
  const addSupply = (id: string) => {
    const a = id; const b = mate(id);
    if (placement[a] === 'tray' && placement[b] === 'tray') commit({ ...placement, [a]: 'left', [b]: 'right' });
  };
  const canCancel = (a: string, b: string): boolean =>
    a !== b && (placement[a] === 'left' || placement[a] === 'right') && placement[a] === placement[b] && faces.get(b) === oppositeFace(faces.get(a)!);
  const cancel = (a: string, b: string) => { if (canCancel(a, b)) commit({ ...placement, [a]: 'bin', [b]: 'bin' }); };

  const place = (item: string, target: string) => {
    if (item.startsWith('add:')) { if (target === 'equation' || target.startsWith('card:')) addSupply(item.slice(4)); }
    else if (target.startsWith('card:')) cancel(item, target.slice(5));
  };
  const drag = useDragPlace<string>(place, locked);

  const cardChip = (id: string) => {
    const chip = drag.chip(id);
    return { ...chip, onToggle: () => {
      if (drag.carried !== null && !drag.carried.startsWith('add:') && canCancel(drag.carried, id)) { cancel(drag.carried, id); drag.clear(); } else chip.onToggle();
    } };
  };

  const carried = drag.carried;
  const carriedFace = carried === null ? null : faces.get(carried.startsWith('add:') ? carried.slice(4) : carried) ?? null;
  const cancelOptions = carried === null || carried.startsWith('add:') ? [] : [...new Map(pieces.filter((piece) => canCancel(carried, piece.id)).map((piece) => [piece.cls, piece.id] as const))]
    .map(([face, id]) => ({ value: `card:${id}`, label: fillSlot(t.cancelWith, caption(face, disguise, t)) }));
  const options = carried?.startsWith('add:') ? [{ value: 'equation', label: t.addBoth }] : cancelOptions;
  const supply = pieces.filter((piece) => piece.id.startsWith('supply-') && piece.id.endsWith('-a') && placement[piece.id] === 'tray' && placement[mate(piece.id)] === 'tray');
  const side = (slot: 'left' | 'right') => <div className="lf-alg-side" role="group" aria-labelledby={`${segment.id}-${slot}`}>
    <h3 id={`${segment.id}-${slot}`} data-copy-role="heading">{slot === 'left' ? t.leftSide : t.rightSide}</h3>
    <div className="lf-alg-cards">
      {inSlot(slot).map((piece) => <span key={piece.id} className="lf-alg-card" data-drop-target={`card:${piece.id}`}>
        <Handle chip={cardChip(piece.id)} disabled={locked}><Face face={piece.cls} disguise={disguise} t={t} /></Handle>
      </span>)}
    </div>
  </div>;

  return <BoardShell screen="algebra-cards" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={history.length === 0 || locked}
    controls={<>
      <Button size="sm" disabled={history.length === 0 || locked} onClick={undo}>{t.undo}</Button>
      <Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>
    </>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={history.length > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metCards, hint: t.hintCards }} onCheck={() => grading.check({ slots: slotsOf(placement, pieces.map((piece) => piece.id)) })} />}>
    <section className="lf-learning-board lf-alg" aria-label={t.cardsCaption}>
      {segment.notation ? <Notation notation={segment.notation} locale={document.locale} /> : null}
      <div className="lf-alg-equation" {...drag.target('equation')}>
        {side('left')}
        <span className="lf-alg-equals" aria-hidden="true" />
        {side('right')}
      </div>
      <p className="lf-alg-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.leftSide}: {wordsOf('left')}. {t.rightSide}: {wordsOf('right')}
      </p>
      <div className="lf-alg-bin" role="group" aria-labelledby={`${segment.id}-bin`}>
        <h3 id={`${segment.id}-bin`} data-copy-role="heading">{t.binName}</h3>
        <ul className="lf-alg-bin-list">{inSlot('bin').map((piece) => <li key={piece.id} data-copy-role="data">{caption(piece.cls, disguise, t)}</li>)}</ul>
      </div>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.cardsCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colSide}</th><th scope="col" data-copy-role="data">{t.colCards}</th></tr></thead>
        <tbody>{(['left', 'right', 'bin'] as const).map((slot) => <tr key={slot}>
          <th scope="row" data-copy-role="data">{slot === 'left' ? t.leftSide : slot === 'right' ? t.rightSide : t.binName}</th><td data-copy-role="data">{wordsOf(slot)}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.supplyName}>
      <h2 data-copy-role="heading">{t.supplyName}</h2>
      <div className="lf-alg-chips">
        {supply.map((piece) => <Handle key={piece.id} chip={drag.chip(`add:${piece.id}`)} disabled={locked}><Face face={piece.cls} disguise={disguise} t={t} /></Handle>)}
      </div>
      <MoveToChoice locale={document.locale} item={carriedFace === null ? null : { label: caption(carriedFace, disguise, t) }} options={options} disabled={locked || options.length === 0}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function CardsBoard({ segment, ...rest }: HorizonteBoardProps) {
  const cards = useMemo(() => (segment.type === 'math.algebra-cards.v2' ? readCards(segment.payload) : null), [segment]);
  return segment.type === 'math.algebra-cards.v2' && cards ? <Cards segment={segment} cards={cards} {...rest} /> : null;
}
