import { useId } from 'react';
import { motion } from 'motion/react';
import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import { RingChart } from '@/components/charts/ring-chart';
import { useSiteCopy } from '@/i18n/useCopy';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { reveal } from '@/lib/motionPresets';
import { body, display, grid, section, statement } from '@/features/landing/type';

/*
 * Landing section 2: the problem, told as one chain and shown. Money habits form in childhood
 * (Cambridge); yet many reach adulthood without having learned, and a ring shows how many, in the
 * visitor's own country (S&P Global FinLit Survey; each language shows its own country's figure,
 * never another's); so a child can practice today. Every number is published, never ours.
 *
 * A symmetric composition at every width: the opening line centered across the page, then the fact
 * and the turn to the offer on six columns and the scene on the other six, each centered on the same
 * horizontal line (the scene is cropped so the characters, not the empty frame, sit at the middle),
 * then the sources centered under both. Stacked and centered below 1024 px.
 */
const OUT_OF = 10;

const FULL = 'col-span-4 md:col-span-8 lg:col-span-12';

const HALF = 'col-span-4 md:col-span-8 lg:col-span-6';

export function Problem() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <motion.section aria-labelledby={titleId} className={`${grid} items-center gap-y-8 text-center ${section}`} {...reveal}>
    <div className={`${FULL} grid justify-items-center gap-4`}>
      <h2 id={titleId} className="grid justify-items-center gap-2">
        <strong className={`block ${display} text-[var(--primary-ink)]`}>{copy.problemBig}</strong>
        <span className="block max-w-[26ch] text-2xl leading-tight font-bold text-balance md:text-[1.75rem]">{copy.problemTitle}</span>
      </h2>
      <p className={body}>{copy.problemLink}</p>
    </div>
    <div className={`${HALF} grid min-w-0 justify-items-center gap-8`}>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
        <div role="img" aria-label={`${copy.problemFigure} ${copy.problemFact}`} className="size-40 shrink-0">
          <div aria-hidden="true" className="size-full">
            <RingChart data={[{ label: copy.problemFigure, value: copy.problemLost, maxValue: OUT_OF }]} size={160} strokeWidth={20} baseInnerRadius={50}>
              <Ring index={0} color="var(--primary)" />
              <RingCenter defaultLabel={copy.problemChartLabel} />
            </RingChart>
          </div>
        </div>
        <p className={`${statement} min-w-0 max-w-[16ch] flex-[1_1_10em] sm:text-start`}><strong className="text-[var(--primary-ink)]">{copy.problemFigure}</strong> {copy.problemFact}</p>
      </div>
      <p className={`${statement} max-w-[26ch] text-[var(--primary-ink)]`}>{copy.problemBridge}</p>
    </div>
    <div aria-hidden="true" className={`${HALF} pointer-events-none -my-4 w-full max-w-xl justify-self-center md:max-w-none lg:my-0`}>
      <LoopVideo name="problem" className="block aspect-[5/3] h-auto w-full object-cover object-[50%_100%] [mask-image:radial-gradient(ellipse_62%_66%_at_50%_54%,#000_58%,transparent_100%)]" />
    </div>
    <p className={`${FULL} mx-auto max-w-[60ch] text-base font-medium text-[var(--v-ink-soft)]`}>{copy.problemSources}</p>
  </motion.section>;
}
