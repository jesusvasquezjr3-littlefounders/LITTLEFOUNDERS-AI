import { useId, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { useLocale, useSiteCopy } from '@/i18n/useCopy';
import { body, heading, lead, section, title } from '@/features/landing/type';

/*
 * The four skills as a staircase: each step opens when the child is ready and sits one tread
 * higher than the last, so the order is read from the shape before any word. The sequence is
 * the information, which is why the steps carry numbers. Color is only a tint; the number, the
 * name and the age say the same thing in words (RESEARCH-FOUNDATION, directive 3).
 *
 * Phones get one column, tablets two, desktop four with the rising treads.
 */
const TONES = ['var(--v-blue)', 'var(--v-olive)', 'var(--v-pink)', 'var(--primary)'] as const;

export function Path() {
  const copy = useSiteCopy().landingV2;
  const number = new Intl.NumberFormat(useLocale());
  const titleId = useId();
  const last = copy.path.length - 1;

  return <section aria-labelledby={titleId} className={`grid gap-10 ${section}`}>
    <div className="grid gap-4">
      <h2 id={titleId} className={`${heading} max-w-[24ch]`}>{copy.pathTitle}</h2>
      <p className={lead}>{copy.pathLead}</p>
    </div>
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {copy.path.map((step, index) => <motion.li key={step.name}
        style={{ '--tone': TONES[index], '--rise': last - index } as CSSProperties}
        className="grid min-w-0 content-start gap-4 rounded-[var(--r-card)] border-t-[3px] border-[var(--tone)] bg-[color-mix(in_oklab,var(--tone)_12%,var(--background))] p-5 lg:mt-[calc(var(--rise)*3.25rem)] lg:p-6"
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}>
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="text-5xl leading-none font-extrabold tabular-nums">{number.format(index + 1)}</span>
          <h3 className={title}><span className="sr-only">{step.step}: </span>{step.name}</h3>
        </div>
        <Badge variant="cream" className="w-fit">{step.age}</Badge>
        <p className={body}>{step.text}</p>
      </motion.li>)}
    </ol>
  </section>;
}
