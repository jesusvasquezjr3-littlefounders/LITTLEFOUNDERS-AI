import type { ReactNode } from 'react';
import type { RebuildCopy } from '../../../i18n/rebuild';
import type { AgeBand, Locale } from '../../design/copyBudget';
import type { LearnerRegister } from '../../design/learnerRegisterPolicy.generated';

/*
 * One screen of the development-only preview entry (`rebuild.html?screen=`).
 * Each wave-2 lane registers its screens in its own file under
 * `preview/registry/` (core, site, learn, mentor, family, profile, staff);
 * `Preview.tsx` only composes the registries, so two lanes adding screens never
 * edit the same file. A screen id is unique across all registries
 * (`registry.test.ts`).
 */
export interface PreviewContext {
  locale: Locale;
  theme: 'light' | 'dark';
  ageBand: AgeBand;
  /** S05.3f (B.23): the learner register a register-aware screen reads in (`?register=`). */
  register: LearnerRegister;
  /** The page's query string, read once at load (fixtures pick their state from it). */
  params: URLSearchParams;
  /** Every rebuilt namespace, in the chosen locale. */
  t: RebuildCopy;
  /** Opens another preview screen in place (resets the scroll position). */
  go: (screen: string) => void;
  /** The screen id being rendered. */
  screen: string;
}

export interface PreviewScreen {
  /**
   * `framed`: rendered inside the preview's design-system root, beside the
   * language, theme and age settings panel. `standalone`: the screen renders
   * its whole page itself (its own root and environment).
   */
  frame: 'framed' | 'standalone';
  render: (context: PreviewContext) => ReactNode;
}

export type PreviewRegistry = Readonly<Record<string, PreviewScreen>>;

export const framed = (render: PreviewScreen['render']): PreviewScreen => ({ frame: 'framed', render });
export const standalone = (render: PreviewScreen['render']): PreviewScreen => ({ frame: 'standalone', render });
