import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type PanInfo } from 'motion/react';
import { AppIcon } from '@/components/AppIcon';
import { Seed } from '@/components/icons/seed';
import type { IconName } from '@/icons/rest';

/*
 * The pile of the home (D-051): a deck of playing cards, face down, with its top card turned over.
 * It is handled like real cards, with no buttons:
 *
 *   - drag the top card and let go, or flick it, and it goes to the bottom of the pile; the next
 *     one turns over. To the left is forward, to the right brings the last card back;
 *   - a tap on a card that leads somewhere plays it: it lifts and the person is taken there. A tap
 *     on the cover, which leads nowhere, passes it;
 *   - under a pointer the top card leans toward it, as a card held between two fingers does;
 *   - with the keyboard the pile is one stop: the arrows pass cards, Enter or Space plays the top one.
 *
 * A screen reader is told which card is on top each time it changes. With reduced motion nothing
 * flies, leans or turns: the top card is simply replaced.
 *
 * A card's face is always light, whatever the page's color mode: a card is paper.
 */
export type DeckCard = {
  id: string;
  /** What a screen reader calls the card. */
  name: string;
  /** The small icon in its two corners, as a card's suit. */
  suit: IconName;
  /** The paper's tint, a color of the theme. */
  tint: string;
  /** A card whose face is a board of its own: it takes the whole card, with no frame and no second corner. */
  isBoard?: boolean;
  /** Where a tap on it leads; a card without it is passed by a tap. */
  onPlay?: () => void;
  face: (isTop: boolean) => ReactNode;
};

// how the cards under the top one lie: a real pile is never square
const LIE = [{ x: 0, y: 0, rotate: 0 }, { x: 9, y: 7, rotate: 4 }, { x: -8, y: 13, rotate: -5 }, { x: 5, y: 18, rotate: 7 }, { x: -4, y: 22, rotate: -3 }, { x: 3, y: 25, rotate: 2 }];

// how far, or how fast, a card has to be carried to be passed
const FAR = 120;

const FAST = 520;

function CardBack() {
  return <span aria-hidden className="absolute inset-0 grid place-items-center rounded-[11%/8%] bg-[var(--lf-card-back)] [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.22) 2px, transparent 2.5px)', backgroundSize: '14px 14px' }}>
    <span className="absolute inset-[6%] rounded-[9%/6.5%] border-2 border-white/40" />
    <span className="grid aspect-square w-[36%] place-items-center rounded-full bg-white"><Seed className="size-[60%]" /></span>
  </span>;
}

/** The suit in a corner of the face; the second one is the same, upside down, as on a real card. */
function Corner({ suit, isFlipped = false }: { suit: IconName; isFlipped?: boolean }) {
  return <span aria-hidden className={`absolute ${isFlipped ? 'bottom-[5%] end-[6%] rotate-180' : 'start-[6%] top-[5%]'}`}><AppIcon name={suit} size="clamp(20px, 11cqw, 34px)" /></span>;
}

function Card({ card, depth, count, onPass, isLeaving }: { card: DeckCard; depth: number; count: number; onPass: (direction: 1 | -1) => void; isLeaving: 1 | null }) {
  const isStill = useReducedMotion() === true;
  const isTop = depth === 0;
  const wasDragged = useRef(false);
  const x = useMotionValue(0);
  // a card dragged sideways turns with the hand that holds it
  const turn = useTransform(x, [-260, 0, 260], [-16, 0, 16]);
  // and under a pointer it leans toward it
  const leanX = useSpring(0, { stiffness: 260, damping: 22 });
  const leanY = useSpring(0, { stiffness: 260, damping: 22 });
  const lie = LIE[Math.min(depth, LIE.length - 1)] ?? { x: 0, y: 0, rotate: 0 };

  const onMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isTop || isStill || event.pointerType !== 'mouse') return;

    const box = event.currentTarget.getBoundingClientRect();

    leanY.set(((event.clientX - box.left) / box.width - 0.5) * 14);
    leanX.set((0.5 - (event.clientY - box.top) / box.height) * 12);
  };

  const rest = () => { leanX.set(0); leanY.set(0); };

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const direction = info.offset.x < 0 ? 1 : -1;

    if (Math.abs(info.offset.x) > FAR || Math.abs(info.velocity.x) > FAST) onPass(direction);
    // let go too early: the card comes back to the top of the pile
    else void animate(x, 0, { type: 'spring', stiffness: 420, damping: 30 });

    // the click that ends a drag is not a tap on the card
    window.setTimeout(() => { wasDragged.current = false; }, 0);
  };

  const onTap = () => {
    if (wasDragged.current) return;

    if (card.onPlay) card.onPlay();
    else onPass(1);
  };

  // A card that was passed first flies out to its side, still above the pile; when the pile lets go
  // of it (Deck clears `isLeaving`) it slides back in underneath.
  return <motion.div className="absolute inset-0 [container-type:inline-size]" style={{ x, zIndex: isLeaving !== null ? count + 1 : count - depth }}
    initial={isStill ? false : { opacity: 0, y: -60, scale: 0.9 }}
    animate={isLeaving !== null && !isStill
      ? { opacity: 1, scale: 1, x: isLeaving * -330, y: 12, rotate: isLeaving * -14 }
      : { opacity: 1, scale: 1 - Math.min(depth, 4) * 0.025, x: isTop ? 0 : lie.x, y: lie.y, rotate: isTop ? 0 : lie.rotate }}
    transition={isStill ? { duration: 0 } : isLeaving !== null ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 320, damping: 26, delay: isTop ? 0 : 0.04 * depth }}
    drag={isTop && !isStill ? 'x' : false} dragElastic={0.9} dragMomentum={false} whileDrag={{ scale: 1.04, cursor: 'grabbing' }}
    onDragStart={() => { wasDragged.current = true; rest(); }} onDragEnd={onDragEnd}>
    <motion.div className="size-full [perspective:1100px]" style={{ rotate: turn, rotateX: leanX, rotateY: leanY }}>
      <motion.button type="button" tabIndex={-1} aria-hidden={!isTop} data-card={card.id} data-top={isTop || undefined}
        className={`relative block size-full rounded-[11%/8%] text-start outline-none [transform-style:preserve-3d] ${isTop ? 'cursor-grab shadow-[0_18px_44px_rgba(17,19,42,0.26)]' : 'cursor-pointer shadow-[0_6px_16px_rgba(17,19,42,0.16)]'}`}
        initial={false} animate={{ rotateY: isTop ? 0 : 180 }} transition={isStill ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 22 }}
        whileHover={isTop && !isStill ? { y: -6 } : undefined} whileTap={isTop && !isStill ? { scale: 0.97 } : undefined}
        onPointerMove={onMove} onPointerLeave={rest}
        // a tap on the pile under the top card passes the top card
        onClick={() => (isTop ? onTap() : onPass(1))}>
        <span className="absolute inset-0 overflow-hidden rounded-[11%/8%] [backface-visibility:hidden]" style={{ background: card.tint, color: 'var(--lf-card-ink)' }}>
          {card.isBoard ? <span className="absolute inset-0 grid p-[6.5%]">{card.face(isTop)}</span> : <>
            <Corner suit={card.suit} />
            <Corner suit={card.suit} isFlipped />
            <span className="absolute inset-[6%] rounded-[9%/6.5%] border-2 border-[color-mix(in_srgb,var(--lf-card-ink)_10%,transparent)]" />
            <span className="absolute inset-0 grid place-items-center px-[10%] py-[16%]">{card.face(isTop)}</span>
          </>}
        </span>
        <CardBack />
      </motion.button>
    </motion.div>
  </motion.div>;
}

/**
 * The pile. `label` names it for a screen reader, `hint` says how the keyboard handles it, and
 * `position(n, total, name)` writes what is announced when the top card changes.
 */
export function Deck({ cards, label, hint, position }: { cards: DeckCard[]; label: string; hint: string; position: (index: number, total: number, name: string) => string }) {
  const [order, setOrder] = useState(() => cards.map((card) => card.id));
  const [leaving, setLeaving] = useState<{ id: string; direction: 1 } | null>(null);
  const known = cards.map((card) => card.id).join('|');
  const release = useRef(0);

  useEffect(() => () => window.clearTimeout(release.current), []);

  // the cards changed (the menu arrived, the language changed): the pile is dealt again from the cover
  useEffect(() => {
    setOrder(known.split('|'));
    setLeaving(null);
  }, [known]);

  const pass = (direction: 1 | -1) => {
    setOrder((current) => {
      if (current.length < 2) return current;

      const first = current[0];
      const last = current.at(-1);

      if (first === undefined || last === undefined) return current;

      return direction === 1 ? [...current.slice(1), first] : [last, ...current.slice(0, -1)];
    });

    // forward, the top card flies out before it goes under; the pile lets go of it a moment later
    const first = order[0];

    if (direction === 1 && first !== undefined && order.length > 1) {
      setLeaving({ id: first, direction });
      window.clearTimeout(release.current);
      release.current = window.setTimeout(() => setLeaving(null), 210);
    }
  };

  const top = cards.find((card) => card.id === order[0]);
  const place = top ? cards.indexOf(top) + 1 : 1;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); pass(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); pass(-1); }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (top?.onPlay) top.onPlay();
      else pass(1);
    }
  };

  return <div className="grid justify-items-center gap-5">
    <div role="group" tabIndex={0} aria-roledescription={label} aria-label={top ? position(place, cards.length, top.name) : label} aria-describedby="deck-hint" data-deck
      className="relative aspect-[5/7] w-[min(340px,70vw)] rounded-[11%/8%] outline-none focus-visible:outline-[3px] focus-visible:outline-offset-[10px] focus-visible:outline-[var(--v-brand)]" onKeyDown={onKey}>
      {cards.map((card) => <Card key={card.id} card={card} depth={order.indexOf(card.id)} count={cards.length} onPass={pass} isLeaving={leaving?.id === card.id ? leaving.direction : null} />)}
    </div>
    <p id="deck-hint" className="sr-only">{hint}</p>
    <p className="sr-only" aria-live="polite">{top ? position(place, cards.length, top.name) : ''}</p>
    {/* where the top card is in the pile: one pip a card, the current one wide */}
    <div aria-hidden className="flex gap-1.5">{cards.map((card, index) => <span key={card.id} className={`h-2 rounded-full transition-all duration-300 ${index + 1 === place ? 'w-6 bg-[var(--v-brand)]' : 'w-2 bg-[var(--v-border)]'}`} />)}</div>
  </div>;
}
