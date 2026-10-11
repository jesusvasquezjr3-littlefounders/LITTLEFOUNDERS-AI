import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MorphIcon } from 'morphicons/react';
import { BookOpen, ChevronLeft, ChevronRight, Flame, House, MessageCircle, SquareCheck, Trophy, Users, Wallet, X } from 'lucide';
import { AgentState } from '@/components/ui/agent-state';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Button } from '@/components/ui/button';
import { Dock, type DockItem } from '@/components/ui/dock';
import { Progress } from '@/components/ui/progress';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenuButton, SidebarMenuLabel, SidebarTrigger } from '@/components/ui/sidebar';
import { Seed } from '@/components/icons/seed';
import { FloatingMentor } from '@/features/appShell/FloatingMentor';
import { Loop } from '@/features/landing/LoopVideo';
import { ENTER } from '@/lib/motionPresets';
import { useTheme } from '@/theme/useTheme';

/*
 * Step 0 of the signed-in application: the owner chose the home to be a deck of real playing cards
 * together with the stage (a scene of the mentor, one sentence, one button). This page shows three
 * ways of putting the two together, for him to pick one before anything is built: `/dev/app`, only
 * in the dev server (App.tsx does not mount it in a production build).
 *
 * What the owner fixed in his reviews (2026-10-11) and every variant follows:
 *   - shapes are round and soft, with no vertices;
 *   - on a desktop the menu is a sidebar that can be collapsed; on a phone it is a dock of icons
 *     with no words;
 *   - the mentor floats in the lower left corner (FloatingMentor.tsx); the "Mentor" destination is
 *     the place to see and set up MentorIA, not the conversation itself;
 *   - one design for ages 13 and over (D-027); only an adult's account adds Family.
 *
 * A tool, not a product screen: its words are Spanish and are not in the locale files, the data is
 * made up, and the icons are stand-ins until the product's own are drawn (T-012).
 *
 *   ?variant=play|table|pile
 *   ?as=learner|adult
 *   ?bare=1                     hides this page's own controls, for a clean look or a screenshot
 */
type Variant = 'play' | 'table' | 'pile';

type Page = 'home' | 'learn' | 'mentor' | 'wallet' | 'tasks' | 'family';

type Width = 'wide' | 'medium' | 'narrow';

const VARIANTS: Record<Variant, { label: string; idea: string }> = {
  play: { label: 'A · Jugar una carta', idea: 'Tienes tu día en la mano. La carta que juegas sube al escenario: cambian la escena, la frase y el botón.' },
  table: { label: 'B · La mesa', idea: 'El escenario dice lo que sigue. Debajo, tu mentor reparte el resto del día sobre la mesa, boca arriba.' },
  pile: { label: 'C · El mazo', idea: 'Tu día es un mazo. La carta de arriba es lo que sigue; la pasas y sale la siguiente.' },
};

const PAGES: Record<Page, { label: string; icon: typeof House; text: string }> = {
  home: { label: 'Inicio', icon: House, text: '' },
  learn: { label: 'Aprender', icon: BookOpen, text: 'El camino de lecciones, con los juegos dentro. Se diseña con su función.' },
  mentor: { label: 'Mentor', icon: MessageCircle, text: 'El lugar de tu mentor: quién es, cómo configurarlo y lo que han hablado. La conversación empieza al tocar al mentor que flota abajo. Se diseña con su función.' },
  wallet: { label: 'Cartera', icon: Wallet, text: 'Tus Semillas como en una app bancaria: tarjetas, saldos, movimientos, cajas de ahorro, transferencias, estados de cuenta y score. Se diseña con su función.' },
  tasks: { label: 'Tareas', icon: SquareCheck, text: 'Lo que te deja tu papá, mamá o tutor, y lo que ganas al cumplirlo. Se diseña con su función.' },
  family: { label: 'Familia', icon: Users, text: 'Solo para adultos: cada hijo, su avance y sus tareas. Se diseña en su propia sesión.' },
};

/** One card of the day: what its corner says, what its face says, and what the stage says when it is played. */
type DayCard = { id: string; page: Page; suit: typeof House; fill: string; title: string; index: string; value: ReactNode; line: string; headline: string; action: string; help: string; scene: string };

type Shared = { width: Width; name: string; cards: DayCard[]; go: (page: Page) => void; start: () => void };

const pick = <T extends string>(value: string | null, options: readonly T[], fallback: T): T => options.find((option) => option === value) ?? fallback;

const readWidth = (): Width => (window.innerWidth >= 1024 ? 'wide' : window.innerWidth >= 700 ? 'medium' : 'narrow');

function useWidth(): Width {
  const [width, setWidth] = useState<Width>(readWidth);

  useEffect(() => {
    const onResize = () => setWidth(readWidth());

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

/*
 * Cojeev draws its cards, its dock tiles and its menu rows with a few radius tokens. Inside the
 * prototype they are raised until nothing has a corner.
 */
const SOFT = { '--r-card': '44px', '--r-card-sm': '999px', '--r-md': '999px', '--r-sm': '999px', '--r-xs': '999px', '--r-sheet': '44px', '--r-panel': '40px' } as CSSProperties;

const EYEBROW = 'm-0 text-[12px] font-extrabold uppercase tracking-[0.1em]';

const BRAND = 'text-[color:var(--v-brand)]';

const QUIET = 'text-[color:var(--v-text-2)]';

const H2 = 'm-0 font-extrabold leading-[1.04] tracking-[-0.03em] text-balance';

const icon = (page: Page, size = 24) => <MorphIcon icon={PAGES[page].icon} size={size} strokeWidth={2} reducedMotion="user" />;

const Balance = ({ className = 'size-8' }: { className?: string }) => <span className="inline-flex items-center gap-1.5 tabular-nums"><Seed className={`${className} shrink-0`} /><AnimatedNumber value={1240} from={1220} locale="es-MX" treatment="roll" /></span>;

const SCENES = '/onboarding/loops/liruf-';

function dayCards(isAdult: boolean): DayCard[] {
  return [
    { id: 'next', page: 'learn', suit: BookOpen, fill: 'var(--v-blue)', title: 'Lo que sigue', index: '3', value: 'Lección 3', line: 'Unidad 1 · vas en 2 de 5 lecciones', headline: 'Tu lección 3 está lista', action: 'Continuar', help: 'tu siguiente lección', scene: 'lean' },
    { id: 'tasks', page: 'tasks', suit: SquareCheck, fill: 'var(--v-pink)', title: 'Tareas', index: '2', value: '2 por hacer', line: 'Ordenar tu cuarto y leer 20 minutos', headline: 'Tienes 2 tareas por hacer', action: 'Ver mis tareas', help: 'tus tareas', scene: 'nod' },
    { id: 'wallet', page: 'wallet', suit: Wallet, fill: 'var(--v-olive)', title: 'Cartera', index: '1,240', value: <Balance className="size-[0.9em]" />, line: '20 Semillas más que ayer', headline: 'Tienes 1,240 Semillas', action: 'Abrir mi cartera', help: 'tu cartera', scene: 'seeds' },
    { id: 'streak', page: 'learn', suit: Flame, fill: 'var(--v-yellow)', title: 'Racha', index: '3', value: '3 días', line: 'Tu mejor racha: 9 días', headline: 'Llevas 3 días seguidos', action: 'Ver mi racha', help: 'tu racha', scene: 'look' },
    isAdult
      ? { id: 'family', page: 'family', suit: Users, fill: 'var(--v-brand)', title: 'Familia', index: '2', value: '2 hijos', line: 'Sofi terminó su unidad ayer', headline: 'Sofi terminó su unidad ayer', action: 'Ver a mi familia', help: 'tu familia', scene: 'nod' }
      : { id: 'league', page: 'learn', suit: Trophy, fill: 'var(--v-brand)', title: 'Liga', index: '8', value: 'Lugar 8', line: 'Suben los primeros 10', headline: 'Vas en el lugar 8 de tu liga', action: 'Ver mi liga', help: 'la liga', scene: 'games' },
  ];
}

/* ------------------------------------------------------------------ the playing card */

/** The corner of a playing card: its number over its suit. The second one is the same, upside down. */
function Corner({ card, size, isFlipped = false }: { card: DayCard; size: number; isFlipped?: boolean }) {
  return <span aria-hidden={isFlipped || undefined} className={`absolute grid justify-items-center gap-0.5 leading-none ${isFlipped ? 'rotate-180' : ''}`} style={isFlipped ? { right: size * 0.07, bottom: size * 0.07 } : { left: size * 0.07, top: size * 0.07 }}>
    <b className="font-extrabold tabular-nums tracking-[-0.02em]" style={{ fontSize: Math.max(13, size * 0.085) }}>{card.index}</b>
    <span style={{ color: card.fill }}><MorphIcon icon={card.suit} size={Math.max(14, size * 0.085)} strokeWidth={2.4} reducedMotion="user" /></span>
  </span>;
}

/*
 * A playing card: 5 by 7, round corners, the number and the suit in two opposite corners, the suit
 * large in the middle, and a patterned back. `isFaceUp` turns it over. What a face says grows with
 * the card: a small one names itself, a large one also says its value and one line.
 */
function PlayingCard({ card, size, isFaceUp = true, children }: { card: DayCard; size: number; isFaceUp?: boolean; children?: ReactNode }) {
  const radius = size * 0.11;
  const side = 'absolute inset-0 shadow-[0_10px_28px_rgba(17,19,42,0.18)] [backface-visibility:hidden]';
  const pip = Math.round(size * (size >= 240 ? 0.26 : 0.36));

  return <span className="block" style={{ width: size, aspectRatio: '5 / 7', perspective: 1000 }}>
    <motion.span className="relative block size-full [transform-style:preserve-3d]" initial={false} animate={{ rotateY: isFaceUp ? 0 : 180 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
      <span className={`${side} grid place-items-center border-2 border-[var(--v-border)] bg-[var(--v-paper)] text-[color:var(--v-text)]`} style={{ borderRadius: radius }}>
        <Corner card={card} size={size} />
        <Corner card={card} size={size} isFlipped />
        <span className="grid justify-items-center gap-1.5 text-center" style={{ paddingInline: size * 0.1, paddingBlock: size * 0.2 }}>
          <span className="grid place-items-center rounded-full text-[color:var(--v-on-accent)]" style={{ width: pip, height: pip, background: card.fill }}><MorphIcon icon={card.suit} size={pip * 0.5} strokeWidth={2} reducedMotion="user" /></span>
          <span className={`${EYEBROW} ${QUIET}`} style={{ fontSize: Math.max(11, Math.min(13, size * 0.075)) }}>{card.title}</span>
          {size >= 140 ? <b className="font-extrabold leading-tight tracking-[-0.02em] tabular-nums" style={{ fontSize: Math.max(17, size * 0.105) }}>{card.value}</b> : null}
          {size >= 170 ? <span className={`text-[13.5px] leading-snug ${QUIET}`}>{card.line}</span> : null}
          {children}
        </span>
      </span>
      <span aria-hidden className={`${side} grid place-items-center bg-[var(--v-brand)] [transform:rotateY(180deg)]`} style={{ borderRadius: radius, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.22) 2px, transparent 2.5px)', backgroundSize: '14px 14px' }}>
        <span className="absolute border-2 border-white/40" style={{ inset: size * 0.06, borderRadius: radius * 0.7 }} />
        <span className="grid place-items-center rounded-full bg-white" style={{ width: size * 0.36, height: size * 0.36 }}><Seed className="size-[60%]" /></span>
      </span>
    </motion.span>
  </span>;
}

/** The scene of the stage: one of the compositions rendered for the onboarding, by its short name. */
const Scene = ({ name, className }: { name: string; className: string }) => <div className={className}><Loop src={`${SCENES}${name}`} width={900} height={900} className="h-auto w-full" priority /></div>;

function Cta({ shared, card, className = '' }: { shared: Shared; card: DayCard; className?: string }) {
  return <Button type="button" variant="accent" size="lg" className={`min-h-[64px] text-[18px] font-extrabold ${shared.width === 'narrow' ? 'w-full' : 'min-w-[220px]'} ${className}`} onClick={() => (card.id === 'next' ? shared.start() : shared.go(card.page))}>{card.action}</Button>;
}

/** What the stage says about a card: its name, one sentence, one line. */
function Words({ card, size, align }: { card: DayCard; size: string; align: 'start' | 'center' }) {
  return <div className={`grid gap-2 ${align === 'center' ? 'justify-items-center text-center' : 'justify-items-start'}`}>
    <p className={`${EYEBROW} ${BRAND}`}>{card.title}</p>
    <h2 className={`${H2} ${size}`}>{card.headline}</h2>
    <p className={`m-0 ${QUIET}`}>{card.line}</p>
  </div>;
}

/* ------------------------------------------------------------------ A. Jugar una carta */

/*
 * The day is a hand of cards, held as a fan. Playing one puts it on the stage: the scene, the
 * sentence and the button become that card's. The stage starts with what comes next.
 */
function Play({ shared }: { shared: Shared }) {
  const { width, cards } = shared;
  const [played, setPlayed] = useState('next');
  const onStage = cards.find((card) => card.id === played) ?? cards[0];
  const hand = cards.filter((card) => card.id !== played);
  const size = width === 'narrow' ? 100 : width === 'medium' ? 140 : 160;
  // On a phone the fan closes as far as the screen asks, so it never runs off it.
  const step = width === 'narrow' ? Math.min(82, (window.innerWidth - 32 - size) / Math.max(1, hand.length - 1)) : width === 'medium' ? 132 : 150;
  const middle = (hand.length - 1) / 2;
  const placed = width === 'narrow' ? 92 : 132;

  if (!onStage) return null;

  return <div className="grid gap-10">
    <div data-help={onStage.help} className={`grid items-center gap-6 ${width === 'wide' ? 'grid-cols-[1fr_auto]' : 'justify-items-center'}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={onStage.id} className={`grid gap-4 ${width === 'wide' ? 'justify-items-start' : 'order-2 w-full justify-items-center'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: ENTER }}>
          <Words card={onStage} size={width === 'narrow' ? 'text-[32px]' : 'text-[54px]'} align={width === 'wide' ? 'start' : 'center'} />
          {onStage.id === 'next' ? <Progress value={2} max={5} appearance="segmented" segments={5} className="w-[240px] max-w-full" aria-label="2 de 5 lecciones" /> : null}
          <Cta shared={shared} card={onStage} />
        </motion.div>
      </AnimatePresence>
      {/* The card that was played lies on the stage, at the foot of the scene. */}
      <div className="relative">
        <Scene name={onStage.scene} className={width === 'narrow' ? 'w-[250px]' : width === 'medium' ? 'w-[330px]' : 'w-[min(420px,34vw)]'} />
        <motion.span layoutId={`card-${onStage.id}`} className="absolute bottom-0 block -rotate-[8deg]" style={{ left: -placed * 0.35 }}><PlayingCard card={onStage} size={placed} /></motion.span>
      </div>
    </div>

    <div className="grid justify-items-center gap-3">
      <p className={`${EYEBROW} ${QUIET}`}>Tu mano · toca una carta para jugarla</p>
      <div className="relative" style={{ width: size + step * (hand.length - 1), height: size * 1.4 + 34 }}>
        {hand.map((card, index) => {
          const offset = index - middle;

          return <motion.button key={card.id} layoutId={`card-${card.id}`} type="button" data-help={card.help} aria-label={`Jugar la carta ${card.title}: ${card.headline}`} className="absolute top-6 origin-bottom rounded-[24px]"
            style={{ left: index * step, zIndex: index }} animate={{ rotate: offset * 6, y: offset * offset * 7 }} whileHover={{ y: -18, rotate: 0 }} whileFocus={{ y: -18, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} onClick={() => setPlayed(card.id)}>
            <PlayingCard card={card} size={size} />
          </motion.button>;
        })}
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ B. La mesa */

const TILT = [-3, 2, -2, 3];

/*
 * The stage always says what comes next. Under it the rest of the day is dealt on a table: each
 * card arrives face down and turns over, and a card opens its section.
 */
function Table({ shared }: { shared: Shared }) {
  const { width, cards, go } = shared;
  const [first, ...rest] = cards;
  const [dealt, setDealt] = useState(0);
  const size = width === 'narrow' ? 142 : width === 'medium' ? 170 : 196;

  useEffect(() => {
    const timer = window.setInterval(() => setDealt((count) => count + 1), 220);

    return () => window.clearInterval(timer);
  }, []);

  if (!first) return null;

  return <div className="grid gap-8">
    <div data-help={first.help} className={`grid items-center gap-6 ${width === 'wide' ? 'grid-cols-[auto_1fr]' : 'justify-items-center'}`}>
      <Scene name={first.scene} className={width === 'narrow' ? 'w-[230px]' : width === 'medium' ? 'w-[300px]' : 'w-[min(340px,28vw)]'} />
      <div className={`grid gap-4 ${width === 'wide' ? 'justify-items-start' : 'w-full justify-items-center'}`}>
        <Words card={first} size={width === 'narrow' ? 'text-[32px]' : 'text-[50px]'} align={width === 'wide' ? 'start' : 'center'} />
        <Progress value={2} max={5} appearance="segmented" segments={5} className="w-[240px] max-w-full" aria-label="2 de 5 lecciones" />
        <Cta shared={shared} card={first} />
      </div>
    </div>

    <section aria-label="El resto de tu día" className={`grid gap-5 rounded-[44px] bg-[var(--v-beige)] ${width === 'narrow' ? 'px-4 py-6' : 'p-8'}`}>
      <p className={`${EYEBROW} ${QUIET} text-center`}>El resto de tu día</p>
      <div className={`flex flex-wrap justify-center ${width === 'narrow' ? 'gap-x-4 gap-y-6' : 'gap-7'}`}>
        {rest.map((card, index) => <motion.button key={card.id} type="button" data-help={card.help} aria-label={`${card.title}: ${card.headline}`} className="rounded-[24px]"
          initial={{ opacity: 0, x: -60, y: -30, rotate: -14 }} animate={{ opacity: 1, x: 0, y: 0, rotate: TILT[index % TILT.length] ?? 0 }} whileHover={{ y: -12, rotate: 0 }} whileFocus={{ y: -12, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 24, delay: index * 0.12 }} onClick={() => go(card.page)}>
          <PlayingCard card={card} size={size} isFaceUp={dealt > index + 1} />
        </motion.button>)}
      </div>
    </section>
  </div>;
}

/* ------------------------------------------------------------------ C. El mazo */

const LEAN = [0, 5, -6, 8, -4];

/*
 * The day is a pile, face down, with its top card turned over. The top card holds everything about
 * one thing and its button. Passing it sends it to the bottom and turns the next one over.
 */
function Pile({ shared }: { shared: Shared }) {
  const { width, cards, name } = shared;
  const [order, setOrder] = useState(() => cards.map((card) => card.id));
  const [sent, setSent] = useState<string | null>(null);
  const size = width === 'narrow' ? Math.min(250, window.innerWidth - 76) : 300;
  const top = cards.find((card) => card.id === order[0]) ?? cards[0];
  const place = cards.findIndex((card) => card.id === top?.id) + 1;
  const pass = () => { setSent(order[0] ?? null); setOrder(([head, ...tail]) => (head ? [...tail, head] : tail)); };
  const back = () => { setSent(null); setOrder((current) => { const last = current.at(-1); return last ? [last, ...current.slice(0, -1)] : current; }); };
  const round = 'size-14 min-w-0 rounded-full p-0';

  if (!top) return null;

  return <div className={`grid items-center gap-8 ${width === 'wide' ? 'min-h-[calc(100dvh-140px)] grid-cols-2' : 'justify-items-center'}`}>
    <div className={`grid gap-4 ${width === 'wide' ? 'justify-items-start' : 'justify-items-center text-center'}`}>
      <Scene name={top.scene} className={width === 'narrow' ? 'w-[200px]' : 'w-[min(320px,26vw)] min-w-[240px]'} />
      <p className={`${EYEBROW} ${BRAND}`}>Hola, {name}</p>
      <h2 className={`${H2} ${width === 'narrow' ? 'text-[32px]' : 'text-[50px]'}`}>Tu día en {cards.length} cartas</h2>
      <p className={`m-0 max-w-[34ch] ${QUIET}`}>La de arriba es lo que sigue. Pásala para ver la siguiente.</p>
    </div>

    <div className="grid justify-items-center gap-6">
      <div className="relative" style={{ width: size + 40, height: size * 1.4 + 50 }}>
        {cards.map((card) => {
          const depth = order.indexOf(card.id);
          const isTop = depth === 0;
          const rest = { x: 20 + depth * 5, y: depth * 9, rotate: LEAN[depth % LEAN.length] ?? 0 };

          return <motion.div key={card.id} data-help={card.help} data-top={isTop || undefined} aria-hidden={isTop ? undefined : true} className="absolute left-0 top-0" style={{ zIndex: cards.length - depth }} initial={false}
            animate={card.id === sent && !isTop ? { x: [rest.x, size * 0.9, rest.x], y: [0, 20, rest.y], rotate: [0, 16, rest.rotate] } : rest} transition={{ duration: 0.5, ease: ENTER }}>
            <PlayingCard card={card} size={size} isFaceUp={isTop}>
              {isTop ? <Button type="button" variant={card.id === 'next' ? 'accent' : 'outline'} className="mt-2 rounded-full font-extrabold" onClick={() => (card.id === 'next' ? shared.start() : shared.go(card.page))}>{card.action}</Button> : null}
            </PlayingCard>
          </motion.div>;
        })}
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" data-icon-only className={round} aria-label="Carta anterior" onClick={back}><MorphIcon icon={ChevronLeft} size={24} strokeWidth={2.2} reducedMotion="user" /></Button>
        <b className="min-w-[8ch] text-center tabular-nums" aria-live="polite">Carta {place} de {cards.length}</b>
        <Button type="button" variant="outline" data-icon-only className={round} aria-label="Pasar a la siguiente carta" onClick={pass}><MorphIcon icon={ChevronRight} size={24} strokeWidth={2.2} reducedMotion="user" /></Button>
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ what every variant shares */

/** A section that is designed later, with its own feature. */
function Later({ page }: { page: Page }) {
  return <div className="mx-auto grid max-w-[560px] justify-items-center gap-4 py-14 text-center">
    <AgentState status={page === 'mentor' ? 'thinking' : 'idle'} size="lg" label={PAGES[page].label} description={PAGES[page].text} />
  </div>;
}

function FocusMode({ onLeave }: { onLeave: () => void }) {
  return <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[color:var(--v-text)]" style={SOFT}>
    <header className="flex items-center gap-4 px-6 py-4">
      <Button type="button" variant="outline" data-icon-only className="size-12 min-w-0 rounded-full p-0" aria-label="Salir de la lección" onClick={onLeave}><MorphIcon icon={X} size={22} strokeWidth={2} reducedMotion="user" /></Button>
      <Progress value={40} className="flex-1" aria-label="Avance de la lección" />
    </header>
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div data-help="esta lección" className="grid max-w-[520px] justify-items-center gap-3 rounded-[44px] bg-[var(--v-beige)] p-10">
        <p className={`${EYEBROW} ${BRAND}`}>Modo enfoque</p>
        <h2 className={`${H2} text-[30px]`}>Aquí va la lección</h2>
        <p className={`m-0 ${QUIET}`}>El menú, la racha y la cartera desaparecen. Quedan salir, el avance, un botón y tu mentor, por si necesitas ayuda.</p>
      </div>
    </div>
    <footer className="flex justify-end px-6 pb-6 pt-2"><Button type="button" variant="accent" size="lg" className="min-h-[64px] min-w-[220px] text-[18px] font-extrabold max-sm:w-full" onClick={onLeave}>Comprobar</Button></footer>
    <FloatingMentor left={16} bottom={16} size={92} />
  </div>;
}

export default function DevAppShell() {
  const [params, setParams] = useSearchParams();
  const { isDark, setChoice } = useTheme();
  const variant = pick<Variant>(params.get('variant'), ['play', 'table', 'pile'], 'play');
  const isAdult = params.get('as') === 'adult';
  const [page, setPage] = useState<Page>('home');
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const rail = useRef<HTMLElement>(null);
  const [railWidth, setRailWidth] = useState(248);
  const width = useWidth();
  const isWide = width === 'wide';
  const shared: Shared = { width, name: isAdult ? 'Laura' : 'Nico', cards: dayCards(isAdult), go: setPage, start: () => setIsFocused(true) };
  const set = (key: string, value: string) => { setPage('home'); setParams((current) => { current.set(key, value); return current; }, { replace: true }); };

  // The mentor stands at the foot of the sidebar, so it follows the sidebar's width as it opens and closes.
  useEffect(() => {
    const element = rail.current;

    if (!element) return undefined;

    const observer = new ResizeObserver(() => setRailWidth(element.offsetWidth));

    observer.observe(element);

    return () => observer.disconnect();
  }, [isWide, isFocused]);

  const pages: Page[] = ['home', 'learn', 'mentor', 'wallet', 'tasks', ...(isAdult ? ['family' as const] : [])];
  const items: DockItem[] = pages.map((key) => ({ value: key, label: PAGES[key].label, icon: icon(key) }));
  const homes: Record<Variant, ReactNode> = { play: <Play shared={shared} />, table: <Table shared={shared} />, pile: <Pile shared={shared} /> };

  if (isFocused) return <FocusMode onLeave={() => setIsFocused(false)} />;

  const chip = (isOn: boolean) => `min-h-9 rounded-full px-3 font-bold ${isOn ? 'bg-[var(--v-ink)] text-[color:var(--v-on-ink)]' : 'bg-[var(--v-beige)]'}`;
  const mentorSize = isWide ? (isOpen ? 112 : 60) : 64;

  return <div className="min-h-dvh bg-[var(--background)] text-[color:var(--v-text)]" style={SOFT}>
    {/* The prototype's own controls: not part of the product. */}
    <div data-prototype-controls hidden={params.get('bare') === '1'} className="grid gap-2 border-b border-dashed border-[var(--v-border)] px-4 py-2 text-[13px] [&[hidden]]:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="me-2">Variante</b>
        {Object.entries(VARIANTS).map(([key, value]) => <button key={key} type="button" aria-pressed={variant === key} className={chip(variant === key)} onClick={() => set('variant', key)}>{value.label}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className={QUIET}>{VARIANTS[variant].idea}</span>
        <span className="flex flex-wrap items-center gap-1.5"><span className={QUIET}>Ver como</span>{([['learner', 'Estudiante'], ['adult', 'Adulto']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={isAdult === (value === 'adult')} className={chip(isAdult === (value === 'adult'))} onClick={() => set('as', value)}>{label}</button>)}</span>
        <button type="button" className={chip(false)} onClick={() => setChoice(isDark ? 'light' : 'dark')}>{isDark ? 'Ver en claro' : 'Ver en oscuro'}</button>
      </div>
    </div>

    <div className={isWide ? 'flex items-start gap-6 p-4' : ''}>
      {/* On a desktop the menu is a sidebar that can be collapsed. Its foot is left free: the mentor stands there. */}
      {isWide ? <Sidebar ref={rail} open={isOpen} onOpenChange={setIsOpen} className="sticky top-4 h-[calc(100dvh-32px)]" style={{ paddingBottom: mentorSize + 28 }}>
        <SidebarHeader>
          {isOpen ? <img src="/brand/logo-white.png" alt="LittleFounders" width={560} height={102} className="h-6 w-auto" /> : null}
          <SidebarTrigger aria-label={isOpen ? 'Contraer el menú' : 'Abrir el menú'} className="text-white"><MorphIcon icon={isOpen ? ChevronLeft : ChevronRight} size={20} strokeWidth={2.4} reducedMotion="user" /></SidebarTrigger>
        </SidebarHeader>
        <SidebarContent aria-label="Secciones">
          {pages.map((key) => <SidebarMenuButton key={key} asChild isActive={page === key} label={PAGES[key].label}>
            <button type="button" data-help={`la sección ${PAGES[key].label}`} className="w-full cursor-pointer text-start" onClick={() => setPage(key)}>{icon(key, 22)}<SidebarMenuLabel>{PAGES[key].label}</SidebarMenuLabel></button>
          </SidebarMenuButton>)}
        </SidebarContent>
      </Sidebar> : null}

      <div className={`mx-auto grid w-full min-w-0 max-w-[1160px] gap-6 ${isWide ? 'pb-8' : 'px-4 pb-[130px] pt-4 sm:px-6'}`}>
        <header className="flex min-h-12 items-center gap-3 sm:gap-4">
          {isWide ? null : <img src={isDark ? '/brand/logo-white.png' : '/brand/logo.png'} alt="LittleFounders" width={560} height={102} className="h-5 w-auto min-[360px]:h-6 sm:h-7" />}
          <span className="flex-1" />
          <span data-help="tu racha" className="inline-flex items-center gap-1.5 font-extrabold tabular-nums" title="Racha: 3 días seguidos"><span className="text-[color:var(--v-pink)]"><MorphIcon icon={Flame} size={22} strokeWidth={2} reducedMotion="user" /></span>3</span>
          <span data-help="tus Semillas" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-extrabold tabular-nums" title="Semillas en tu cartera"><Seed className="size-[22px]" /><AnimatedNumber value={1240} locale="es-MX" /></span>
          <button type="button" aria-label="Tu perfil, ajustes y cerrar sesión" className="grid size-11 place-items-center rounded-full bg-[var(--v-blue)] font-extrabold text-[color:var(--v-on-accent)]">{shared.name.slice(0, 1)}</button>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main key={`${variant}-${page}-${isAdult}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: ENTER }}>
            {page === 'home' ? homes[variant] : <Later page={page} />}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>

    {/* On a phone the menu is a dock of icons, with no words. */}
    {isWide ? null : <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-3 [&_[data-part=label]]:!hidden">
      <Dock items={items} variant="glass" value={page} onValueChange={(value) => setPage(pick<Page>(value, pages, 'home'))} itemSize={width === 'narrow' ? (window.innerWidth < 360 ? 38 : 50) : 56} magnification={1.15} aria-label="Secciones" />
    </div>}

    <FloatingMentor left={isWide ? 16 + (railWidth - mentorSize) / 2 : 12} bottom={isWide ? 28 : 112} size={mentorSize} />
  </div>;
}
