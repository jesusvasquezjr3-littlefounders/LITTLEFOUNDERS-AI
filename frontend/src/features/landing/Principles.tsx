import { useId } from 'react';
import { useSiteCopy } from '@/i18n/useCopy';
import { align, alignItems, body, grid, heading, section, title } from '@/features/landing/type';

/*
 * What stays true however the product grows: typographic, no cards and no icons. The heading takes
 * the first row; the two statements share the next one, six columns each from 1024 px, each under a
 * hairline, so no column is left empty. Centered on phones.
 */
export function Principles() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`${grid} gap-y-8 ${section}`}>
    <h2 id={titleId} className={`${heading} ${align} col-span-4 md:col-span-8 lg:col-span-7`}>{copy.principlesTitle}</h2>
    {copy.principles.map((item) => <div key={item.name} className={`col-span-4 grid content-start gap-2 border-t border-[var(--v-border)] pt-5 md:col-span-4 lg:col-span-6 ${alignItems} ${align}`}>
      <h3 className={title}>{item.name}</h3>
      <p className={body}>{item.text}</p>
    </div>)}
  </section>;
}
