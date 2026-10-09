import { useId } from 'react';
import { motion } from 'motion/react';
import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import { RingChart } from '@/components/charts/ring-chart';
import { useSiteCopy } from '@/i18n/useCopy';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { body, display, section } from '@/features/landing/type';

/*
 * Landing section 2: the problem, told as one chain and shown. Money habits
 * form in childhood (Cambridge); yet many reach adulthood without having
 * learned, and a ring shows how many, in the visitor's own country (S&P Global
 * FinLit Survey; each language shows its own country's figure, never
 * another's); so a child can practice today. Every number is published, never
 * ours. One footnote names the sources.
 */

const OUT_OF = 10;

const reveal = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.35 }, transition: { duration: 0.5 } } as const;

export function Problem() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`grid items-end gap-8 md:grid-cols-2 md:gap-10 ${section}`}>
    <motion.div className="grid min-w-0 content-start justify-items-start gap-6" {...reveal}>
      <h2 id={titleId} className="grid gap-2">
        <strong className={`block ${display} text-[var(--primary-ink)]`}>{copy.problemBig}</strong>
        <span className={`block max-w-[26ch] text-[clamp(1.5rem,3vw,2rem)] leading-tight font-bold text-balance`}>{copy.problemTitle}</span>
      </h2>
      <p className={`${body} text-[var(--muted-foreground)]`}>{copy.problemLink}</p>
      <div className="flex w-full flex-wrap items-center gap-6">
        <div role="img" aria-label={`${copy.problemFigure} ${copy.problemFact}`} className="size-40 shrink-0">
          <div aria-hidden="true" className="size-full">
            <RingChart data={[{ label: copy.problemFigure, value: copy.problemLost, maxValue: OUT_OF }]} size={160} strokeWidth={20} baseInnerRadius={50}>
              <Ring index={0} color="var(--primary)" />
              <RingCenter defaultLabel={copy.problemChartLabel} />
            </RingChart>
          </div>
        </div>
        <p className="min-w-0 flex-[1_1_10em] text-[clamp(1.375rem,2.6vw,1.75rem)] leading-tight font-bold text-balance"><strong className="text-[var(--primary-ink)]">{copy.problemFigure}</strong> {copy.problemFact}</p>
      </div>
      <p className="max-w-[32ch] rounded-[var(--r-frame)] bg-[var(--v-beige)] px-6 py-4 text-[clamp(1.375rem,2.6vw,1.75rem)] leading-tight font-bold text-balance text-[var(--primary-ink)]">{copy.problemBridge}</p>
      <p className="max-w-[60ch] text-base text-[var(--muted-foreground)]">{copy.problemSources}</p>
    </motion.div>
    <div aria-hidden="true" className="pointer-events-none w-full max-w-[38rem] justify-self-center md:justify-self-end">
      <LoopVideo name="problem" className="block aspect-[5/4] h-auto w-full object-cover [mask-image:radial-gradient(ellipse_60%_62%_at_50%_54%,#000_58%,transparent_100%)]" />
    </div>
  </section>;
}
