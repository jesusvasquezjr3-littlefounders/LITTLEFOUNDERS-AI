import { useId, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { useLocale, useSiteCopy } from '@/i18n/useCopy';
import { body, grid, heading, lead, section, title } from '@/features/landing/type';

/*
 * The four skills in order: the heading and its sentence on five columns, the steps on seven, one
 * row per step. The order is the information, so each step carries its number; the number sits in a
 * tinted square, and the name, the age and the sentence say the rest in words. Color is only a tag
 * (RESEARCH-FOUNDATION, directive 3), and the label on each tint is the one measured for it.
 * Below 1024 px the heading stacks over the steps.
 */
const TONES = [
  { fill: 'var(--v-blue)', ink: 'var(--v-on-accent)' },
  { fill: 'var(--v-olive)', ink: 'var(--v-on-accent)' },
  { fill: 'var(--v-pink)', ink: 'var(--v-on-accent)' },
  { fill: 'var(--primary)', ink: 'var(--primary-foreground)' },
] as const;

export function Path() {
  const copy = useSiteCopy().landingV2;
  const number = new Intl.NumberFormat(useLocale());
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`${grid} gap-y-10 ${section}`}>
    <div className="col-span-4 grid min-w-0 content-start gap-4 md:col-span-8 lg:col-span-5">
      <h2 id={titleId} className={heading}>{copy.pathTitle}</h2>
      <p className={lead}>{copy.pathLead}</p>
    </div>
    <ol className="col-span-4 grid md:col-span-8 lg:col-span-7">
      {copy.path.map((step, index) => <motion.li key={step.name}
        style={{ '--fill': TONES[index]?.fill, '--ink': TONES[index]?.ink } as CSSProperties}
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-[var(--v-border)] py-6 first:border-t-0 first:pt-0 last:pb-0"
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}>
        <span aria-hidden="true" className="row-span-3 grid size-14 place-items-center rounded-[var(--r-card-sm)] bg-[var(--fill)] text-2xl leading-none font-extrabold tabular-nums text-[var(--ink)]">{number.format(index + 1)}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className={title}><span className="sr-only">{step.step}: </span>{step.name}</h3>
          <Badge variant="cream">{step.age}</Badge>
        </div>
        <p className={body}>{step.text}</p>
      </motion.li>)}
    </ol>
  </section>;
}
