import { useId } from 'react';
import { motion } from 'motion/react';
import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import { RingChart } from '@/components/charts/ring-chart';
import { useSiteCopy } from '@/i18n/useCopy';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { body, display, grid, section, statement } from '@/features/landing/type';

/*
 * Landing section 2: the problem, told as one chain and shown. Money habits form in childhood
 * (Cambridge); yet many reach adulthood without having learned, and a ring shows how many, in the
 * visitor's own country (S&P Global FinLit Survey; each language shows its own country's figure,
 * never another's); so a child can practice today. Every number is published, never ours.
 *
 * Six columns of text and six of video, vertically centered on each other. One strong line opens the
 * argument; the fact and the turn to the offer follow at one lower step, the turn in the brand color.
 */
const OUT_OF = 10;
const reveal = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.35 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } as const;

export function Problem() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`${grid} items-center gap-y-10 ${section}`}>
    <motion.div className="col-span-4 grid min-w-0 content-start justify-items-start gap-6 md:col-span-8 lg:col-span-6" {...reveal}>
      <h2 id={titleId} className="grid gap-2">
        <strong className={`block ${display} text-[var(--primary-ink)]`}>{copy.problemBig}</strong>
        <span className="block max-w-[22ch] text-2xl leading-tight font-bold text-balance md:text-[1.75rem]">{copy.problemTitle}</span>
      </h2>
      <p className={`${body} text-[var(--muted-foreground)]`}>{copy.problemLink}</p>
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-4">
        <div role="img" aria-label={`${copy.problemFigure} ${copy.problemFact}`} className="size-40 shrink-0">
          <div aria-hidden="true" className="size-full">
            <RingChart data={[{ label: copy.problemFigure, value: copy.problemLost, maxValue: OUT_OF }]} size={160} strokeWidth={20} baseInnerRadius={50}>
              <Ring index={0} color="var(--primary)" />
              <RingCenter defaultLabel={copy.problemChartLabel} />
            </RingChart>
          </div>
        </div>
        <p className={`${statement} min-w-0 flex-[1_1_12em]`}><strong className="text-[var(--primary-ink)]">{copy.problemFigure}</strong> {copy.problemFact}</p>
      </div>
      <p className={`${statement} max-w-[28ch] text-[var(--primary-ink)]`}>{copy.problemBridge}</p>
      <p className="max-w-[60ch] text-base text-[var(--muted-foreground)]">{copy.problemSources}</p>
    </motion.div>
    <div aria-hidden="true" className="pointer-events-none col-span-4 -my-4 w-full max-w-xl md:col-span-8 md:max-w-none md:-my-8 lg:col-span-6 lg:my-0">
      <LoopVideo name="problem" className="block aspect-[5/4] h-auto w-full object-cover [mask-image:radial-gradient(ellipse_60%_62%_at_50%_54%,#000_58%,transparent_100%)]" />
    </div>
  </section>;
}
