import type { MouseEvent } from 'react';
import en from '../../i18n/en-US/rebuild-learn.json';
import es from '../../i18n/es-MX/rebuild-learn.json';
import pt from '../../i18n/pt-BR/rebuild-learn.json';
import type { Locale } from '../design/copyBudget';

/*
 * W2L: the learner lane's rebuilt copy (`rebuild-learn.json`, budgeted in
 * rebuild/copy-budget/learn.test.ts). Placeholders are `{name}`; a count picks
 * its `…One` / `…Other` form by the locale's plural rules.
 */
export const learnCopy: Record<Locale, typeof en> = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export function plural(locale: Locale, count: number, one: string, other: string): string {
  return fill(new Intl.PluralRules(locale).select(count) === 'one' ? one : other, { n: new Intl.NumberFormat(locale).format(count) });
}

/** Where the learner pages go. The host builds the URLs (the route table lives outside the rebuilt tree). */
export interface LearnLinks {
  home: string;
  course: (slug: string) => string;
  lesson: (lessonId: string) => string;
  placement: (slug: string) => string;
  territory: (slug: string) => string;
  rhythm: string;
  journal: string;
  /** L-04: goals together (13 to 17). Optional so older hosts and previews still type-check. */
  together?: string;
  /** Bible 08 §8 (GAP-FIX-R1): the Mentor screen the home card opens. Optional for older hosts and previews. */
  mentor?: string;
  /** The game host (KRV1-CONTRACT §6): the Learn home's "Play with {Mentor}" card opens it. Optional for older hosts and previews. */
  play?: string;
}

/** Client-side navigation; `courseSlug` tells the lesson player where "exit" returns. */
export type LearnNavigate = (href: string, state?: { courseSlug: string }) => void;

/**
 * A real link (it goes somewhere; it opens in a new tab on a modified click)
 * that navigates inside the app on a plain click.
 */
export function linkTo(href: string, navigate: LearnNavigate, state?: { courseSlug: string }) {
  return {
    href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(href, state);
    },
  };
}
