import { useId } from 'react';
import { useSiteCopy } from '@/i18n/useCopy';
import { body, heading, section, title } from '@/features/landing/type';

/*
 * What stays true however the product grows: typographic, no cards and no icons. The heading
 * takes the left column on desktop, the two statements stack on the right, each under a hairline.
 */
export function Principles() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 ${section}`}>
    <h2 id={titleId} className={`${heading} max-w-[16ch]`}>{copy.principlesTitle}</h2>
    <div className="grid gap-8">
      {copy.principles.map((item) => <div key={item.name} className="grid gap-2 border-t border-[var(--v-border)] pt-5">
        <h3 className={title}>{item.name}</h3>
        <p className={`${body} text-[var(--muted-foreground)]`}>{item.text}</p>
      </div>)}
    </div>
  </section>;
}
