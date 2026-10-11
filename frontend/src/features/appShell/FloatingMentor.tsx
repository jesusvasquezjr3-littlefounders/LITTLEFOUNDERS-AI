import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MorphIcon } from 'morphicons/react';
import { X } from 'lucide';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/features/avatars/Avatar';

/*
 * The mentor as the owner described it for the product (context for the prototypes, not a designed
 * feature): it floats in the lower left corner, a tap starts a conversation with it, and it can be
 * dragged onto anything on the screen to ask about that thing: an explanation, how to use it, or a
 * report about it. Anything that carries `data-help="its name"` can receive it.
 *
 * Part of the `/dev/app` prototype: Spanish words that are not in the locale files, and no
 * conversation behind the buttons.
 */
type Target = { name: string; box: DOMRect };

const ASKS = ['Explícame esto', 'No sé cómo usarlo', 'Quiero reportar algo'];

export function FloatingMentor({ left, bottom, size }: { left: number; bottom: number; size: number }) {
  const root = useRef<HTMLDivElement>(null);
  const wasDragged = useRef(false);
  const [over, setOver] = useState<Target | null>(null);
  const [about, setAbout] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  /** The nearest thing under a point of the screen that can be asked about, ignoring the mentor itself. */
  const targetAt = (x: number, y: number): Target | null => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (root.current?.contains(element)) continue;

      const found = element.closest<HTMLElement>('[data-help]');

      if (found?.dataset.help) return { name: found.dataset.help, box: found.getBoundingClientRect() };
    }

    return null;
  };

  return <>
    {over ? <div aria-hidden className="pointer-events-none fixed z-30 rounded-[36px] border-4 border-dashed border-[var(--v-brand)]" style={{ left: over.box.left - 6, top: over.box.top - 6, width: over.box.width + 12, height: over.box.height + 12 }} /> : null}

    <AnimatePresence>
      {isOpen ? <motion.div role="dialog" aria-label="Liruf, tu mentor" className="fixed z-40 grid w-[min(300px,calc(100vw-24px))] gap-3 rounded-[32px] bg-[var(--v-paper)] p-5 text-[color:var(--v-text)] shadow-[0_18px_50px_rgba(17,19,42,0.24)]"
        style={{ left: Math.max(12, left), bottom: bottom + size + 12 }} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }} transition={{ duration: 0.2 }}>
        <div className="flex items-start gap-2">
          <p className="m-0 flex-1 text-[17px] font-extrabold leading-snug">{about ? <>¿Qué necesitas con <span className="text-[color:var(--v-brand)]">{about}</span>?</> : '¿En qué te ayudo?'}</p>
          <Button type="button" variant="ghost" data-icon-only className="size-10 min-w-0 rounded-full p-0" aria-label="Cerrar" onClick={() => setIsOpen(false)}><MorphIcon icon={X} size={18} strokeWidth={2} reducedMotion="user" /></Button>
        </div>
        <div className="grid gap-2">{ASKS.map((ask) => <Button key={ask} type="button" variant="outline" className="justify-start rounded-full font-bold">{ask}</Button>)}</div>
        {about ? null : <p className="m-0 text-[13px] text-[color:var(--v-text-2)]">También puedes arrastrarme encima de cualquier cosa de la pantalla.</p>}
      </motion.div> : null}
    </AnimatePresence>

    <motion.div ref={root} className="fixed z-40 cursor-grab touch-none active:cursor-grabbing" style={{ left, bottom, width: size }}
      drag dragSnapToOrigin dragMomentum={false} dragElastic={0.1} whileDrag={{ scale: 1.1 }}
      animate={{ y: [0, -5, 0] }} transition={{ y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } }}
      onDragStart={() => { wasDragged.current = true; setIsOpen(false); }}
      onDrag={(_event, info) => setOver(targetAt(info.point.x - window.scrollX, info.point.y - window.scrollY))}
      onDragEnd={(_event, info) => {
        const target = targetAt(info.point.x - window.scrollX, info.point.y - window.scrollY);

        setOver(null);

        if (target) { setAbout(target.name); setIsOpen(true); }

        // The click that ends a drag is not a tap on the mentor.
        window.setTimeout(() => { wasDragged.current = false; }, 0);
      }}>
      <button type="button" aria-label="Hablar con Liruf, tu mentor" className="block w-full rounded-full bg-transparent p-0" onClick={() => { if (wasDragged.current) return; setAbout(null); setIsOpen((open) => !open); }}>
        <Avatar character="liruf" expression={over ? 'excited' : 'happy'} className="pointer-events-none block w-full" />
      </button>
    </motion.div>
  </>;
}
